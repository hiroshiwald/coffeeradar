import { NextRequest, NextResponse } from "next/server";
import { hasTurso, initDb, getCoffees, getFeedHealth, upsertCoffees, saveFeedHealth, cleanOldData } from "@/lib/db";
import { fetchAllFeeds } from "@/lib/feedFetcher";
import { FALLBACK_COFFEES } from "@/lib/fallback";
import { ApiResponse } from "@/lib/types";
import { checkSiteAuthFromRequest } from "@/lib/authGuard";
import { setSourceHealth } from "@/lib/sourceStore";
import { logger } from "@/lib/logger";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Run an async task after the response is sent (Vercel), or fire-and-forget (local dev). */
function scheduleBackground(fn: () => Promise<void>): void {
  try {
    waitUntil(fn());
  } catch {
    // Local dev: fire-and-forget (won't complete if process exits early)
    fn().catch((err) => logger.error("[coffees] background refresh failed", err));
  }
}

export async function GET(request: NextRequest) {
  const { authorized } = await checkSiteAuthFromRequest(request);
  if (!authorized) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";

  if (!hasTurso()) {
    return handleWithoutDb(forceRefresh);
  }

  return handleWithDb(forceRefresh);
}

async function handleWithDb(forceRefresh: boolean): Promise<NextResponse> {
  try {
    await initDb();

    // Manual refresh: return stale DB data immediately, refresh feeds in background.
    if (forceRefresh) {
      const [coffees, health] = await Promise.all([getCoffees(), getFeedHealth()]);
      const isEmpty = coffees.length === 0;
      const response: ApiResponse = {
        coffees: isEmpty ? FALLBACK_COFFEES : coffees,
        meta: {
          healthy: health?.healthy ?? 0,
          failed: health?.failed ?? 0,
          total: health?.total ?? 0,
          lastRefresh: health?.lastRefresh ?? new Date().toISOString(),
          isFallback: isEmpty,
          backgroundRefresh: true,
        },
      };
      scheduleBackground(async () => {
        const { coffees: fetched, healthy, failed, total } = await fetchAllFeeds();
        if (fetched.length > 0) {
          await upsertCoffees(fetched);
          await saveFeedHealth(healthy, failed, total);
          await cleanOldData();
        }
      });
      return NextResponse.json(response);
    }

    // Normal path: read from DB (instant)
    const [coffees, health] = await Promise.all([getCoffees(), getFeedHealth()]);
    const isEmpty = coffees.length === 0;
    return NextResponse.json({
      coffees: isEmpty ? FALLBACK_COFFEES : coffees,
      meta: {
        healthy: health?.healthy ?? 0,
        failed: health?.failed ?? 0,
        total: health?.total ?? 0,
        lastRefresh: health?.lastRefresh ?? new Date().toISOString(),
        isFallback: isEmpty,
      },
    } satisfies ApiResponse);
  } catch (err) {
    logger.error("[coffees] DB read failed, returning fallback", err);
    return NextResponse.json({
      coffees: FALLBACK_COFFEES,
      meta: { healthy: 0, failed: 0, total: 0, lastRefresh: new Date().toISOString(), isFallback: true },
    } satisfies ApiResponse);
  }
}

// Module-scoped in-memory cache for the local-dev (no-Turso) path. Scoped to
// this module rather than `globalThis` so it can't leak across unrelated
// modules and is easy to reset in tests.
const LOCAL_CACHE_TTL_MS = 30 * 60 * 1000;
let localCache: { data: ApiResponse; ts: number } | null = null;

// Fallback for local dev without Turso
async function handleWithoutDb(forceRefresh: boolean): Promise<NextResponse> {
  if (!forceRefresh && localCache && Date.now() - localCache.ts < LOCAL_CACHE_TTL_MS) {
    return NextResponse.json(localCache.data);
  }

  // Return stale cache immediately if available, refresh in background
  if (forceRefresh && localCache) {
    const stale: ApiResponse = {
      ...localCache.data,
      meta: { ...localCache.data.meta, backgroundRefresh: true },
    };
    scheduleBackground(async () => {
      try {
        const { coffees, healthy, failed, total, feedResults } = await fetchAllFeeds();
        const healthMap: Record<string, string> = {};
        for (const r of feedResults) healthMap[r.url] = r.status;
        await setSourceHealth(healthMap);
        const fresh: ApiResponse = {
          coffees: coffees.length > 0 ? coffees : FALLBACK_COFFEES,
          meta: { healthy, failed, total, lastRefresh: new Date().toISOString(), isFallback: coffees.length === 0 },
        };
        localCache = { data: fresh, ts: Date.now() };
      } catch (err) {
        logger.error("[coffees] background refresh failed", err);
      }
    });
    return NextResponse.json(stale);
  }

  // First load or forceRefresh with no cache: synchronous fetch
  try {
    const { coffees, healthy, failed, total, feedResults } = await fetchAllFeeds();
    const healthMap: Record<string, string> = {};
    for (const r of feedResults) healthMap[r.url] = r.status;
    await setSourceHealth(healthMap);
    const response: ApiResponse = {
      coffees: coffees.length > 0 ? coffees : FALLBACK_COFFEES,
      meta: { healthy, failed, total, lastRefresh: new Date().toISOString(), isFallback: coffees.length === 0 },
    };
    localCache = { data: response, ts: Date.now() };
    return NextResponse.json(response);
  } catch (err) {
    logger.error("[coffees] feed fetch failed, returning fallback", err);
    return NextResponse.json({
      coffees: FALLBACK_COFFEES,
      meta: { healthy: 0, failed: 0, total: 0, lastRefresh: new Date().toISOString(), isFallback: true },
    } satisfies ApiResponse);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { hasTurso, initDb, getCoffees, getFeedHealth, upsertCoffees, saveFeedHealth } from "@/lib/db";
import { fetchAllFeeds } from "@/lib/feedFetcher";
import { FALLBACK_COFFEES } from "@/lib/fallback";
import { ApiResponse } from "@/lib/types";
import { checkSiteAuthFromRequest } from "@/lib/authGuard";
import { logger } from "@/lib/logger";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { authorized } = await checkSiteAuthFromRequest(request);
  if (!authorized) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";

  // If Turso is not configured, fall back to direct feed fetching (local dev)
  if (!hasTurso()) {
    return handleWithoutDb(forceRefresh);
  }

  try {
    await initDb();

    // Manual refresh: fetch feeds, write to DB, then read back from DB
    // so the response is filtered identically to the normal read path.
    if (forceRefresh) {
      const { coffees: fetched, healthy, failed, total } = await fetchAllFeeds();
      if (fetched.length > 0) {
        await upsertCoffees(fetched);
        await saveFeedHealth(healthy, failed, total);
      }
      const coffees = await getCoffees();
      const response: ApiResponse = {
        coffees: coffees.length > 0 ? coffees : FALLBACK_COFFEES,
        meta: {
          healthy,
          failed,
          total,
          lastRefresh: new Date().toISOString(),
          isFallback: coffees.length === 0,
        },
      };
      return NextResponse.json(response);
    }

    // Normal path: read from DB (instant)
    const [coffees, health] = await Promise.all([getCoffees(), getFeedHealth()]);

    if (coffees.length === 0) {
      // DB empty — return fallback data
      return NextResponse.json({
        coffees: FALLBACK_COFFEES,
        meta: {
          healthy: health?.healthy ?? 0,
          failed: health?.failed ?? 0,
          total: health?.total ?? 0,
          lastRefresh: health?.lastRefresh ?? new Date().toISOString(),
          isFallback: true,
        },
      } satisfies ApiResponse);
    }

    return NextResponse.json({
      coffees,
      meta: {
        healthy: health?.healthy ?? 0,
        failed: health?.failed ?? 0,
        total: health?.total ?? 0,
        lastRefresh: health?.lastRefresh ?? new Date().toISOString(),
        isFallback: false,
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
  try {
    const { coffees, healthy, failed, total, feedResults } = await fetchAllFeeds();
    const { setInMemoryHealth } = await import("@/lib/sources");
    const healthMap: Record<string, string> = {};
    for (const r of feedResults) healthMap[r.url] = r.status;
    setInMemoryHealth(healthMap);
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

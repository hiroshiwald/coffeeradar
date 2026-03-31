import { NextRequest, NextResponse } from "next/server";
import { hasTurso, initDb, getCoffees, getFeedHealth, upsertCoffees, saveFeedHealth, cleanOldEntries } from "@/lib/db";
import { fetchAllFeeds } from "@/lib/feedFetcher";
import { FALLBACK_COFFEES } from "@/lib/fallback";
import { ApiResponse } from "@/lib/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";

  // If Turso is not configured, fall back to direct feed fetching (local dev)
  if (!hasTurso()) {
    return handleWithoutDb(forceRefresh);
  }

  try {
    await initDb();

    // Manual refresh: fetch feeds, write to DB, return fresh data
    if (forceRefresh) {
      const { coffees, healthy, failed, total } = await fetchAllFeeds();
      if (coffees.length > 0) {
        await upsertCoffees(coffees);
        await saveFeedHealth(healthy, failed, total);
        await cleanOldEntries();
      }
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
  } catch {
    return NextResponse.json({
      coffees: FALLBACK_COFFEES,
      meta: { healthy: 0, failed: 0, total: 0, lastRefresh: new Date().toISOString(), isFallback: true },
    } satisfies ApiResponse);
  }
}

// Fallback for local dev without Turso
async function handleWithoutDb(forceRefresh: boolean): Promise<NextResponse> {
  // Simple in-memory approach for local dev
  if (!forceRefresh && globalCache && Date.now() - globalCache.ts < 30 * 60 * 1000) {
    return NextResponse.json(globalCache.data);
  }
  try {
    const { coffees, healthy, failed, total } = await fetchAllFeeds();
    const response: ApiResponse = {
      coffees: coffees.length > 0 ? coffees : FALLBACK_COFFEES,
      meta: { healthy, failed, total, lastRefresh: new Date().toISOString(), isFallback: coffees.length === 0 },
    };
    globalCache = { data: response, ts: Date.now() };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({
      coffees: FALLBACK_COFFEES,
      meta: { healthy: 0, failed: 0, total: 0, lastRefresh: new Date().toISOString(), isFallback: true },
    } satisfies ApiResponse);
  }
}

let globalCache: { data: ApiResponse; ts: number } | null = null;

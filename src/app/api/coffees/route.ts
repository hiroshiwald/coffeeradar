import { NextRequest, NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/cache";
import { fetchAllFeeds } from "@/lib/feedFetcher";
import { FALLBACK_COFFEES } from "@/lib/fallback";
import { ApiResponse } from "@/lib/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";

  if (!forceRefresh) {
    const cached = getCached();
    if (cached) return NextResponse.json(cached);
  }

  try {
    const { coffees, healthy, failed, total } = await fetchAllFeeds();

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

    setCache(response);
    return NextResponse.json(response);
  } catch {
    const fallback: ApiResponse = {
      coffees: FALLBACK_COFFEES,
      meta: {
        healthy: 0,
        failed: 0,
        total: 0,
        lastRefresh: new Date().toISOString(),
        isFallback: true,
      },
    };
    return NextResponse.json(fallback);
  }
}

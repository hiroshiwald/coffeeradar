import { NextRequest, NextResponse } from "next/server";
import { initDb, upsertCoffees, saveFeedHealth, saveFeedResults, cleanOldData } from "@/lib/db";
import { fetchAllFeeds } from "@/lib/feedFetcher";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initDb();
    const { coffees, healthy, failed, total, feedResults } = await fetchAllFeeds();
    await upsertCoffees(coffees);
    await saveFeedHealth(healthy, failed, total);
    await saveFeedResults(feedResults);
    const cleaned = await cleanOldData();

    return NextResponse.json({
      ok: true,
      inserted: coffees.length,
      healthy,
      failed,
      total,
      cleanedCoffees: cleaned.coffees,
      cleanedFeedResults: cleaned.feedResults,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

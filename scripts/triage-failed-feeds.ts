/**
 * Standalone verification script for the failed-feed triage pipeline.
 *
 * Usage:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/triage-failed-feeds.ts [limit]
 *
 * Picks up to `limit` (default 5) sources whose most recent feed fetch
 * status is "error", runs each through triageFailedFeed, and prints a
 * summary table.
 *
 * This does NOT write to the DB — it is read-only so you can sanity-check
 * the pipeline against real data before exposing it in the admin panel.
 */

import { getFeedResults } from "../src/lib/db";
import { listMasterSources } from "../src/lib/sourceStore";
import { triageFailedFeed } from "../src/lib/feedTriage";

async function main() {
  const limit = Number(process.argv[2] ?? "5");

  if (!process.env.TURSO_DATABASE_URL) {
    console.error("TURSO_DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  const [sources, health] = await Promise.all([listMasterSources(), getFeedResults()]);
  const failed = sources.filter((s) => health[s.url] === "error" && s.enabled !== false);

  if (failed.length === 0) {
    console.log("No failed feeds in the current DB. Nothing to triage.");
    return;
  }

  const pick = failed.slice(0, limit);
  console.log(`Triaging ${pick.length} of ${failed.length} failed feeds...\n`);

  const rows: Array<{
    name: string;
    site: string;
    status: string;
    discoveredFeedUrl?: string;
    recommendation: string;
  }> = [];

  for (const source of pick) {
    process.stdout.write(`  • ${source.name} (${source.website}) ... `);
    const result = await triageFailedFeed(source);
    process.stdout.write(`${result.status}\n`);
    rows.push({
      name: result.name,
      site: result.site,
      status: result.status,
      discoveredFeedUrl: result.discoveredFeedUrl,
      recommendation: result.recommendation,
    });
  }

  console.log("\nResults:\n");
  console.log(JSON.stringify(rows, null, 2));

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log("\nSummary:", counts);
}

main().catch((err) => {
  console.error("triage-failed-feeds script failed:", err);
  process.exit(1);
});

import { createClient } from "@libsql/client/web";

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const queries = [
    { label: "Total row count", sql: "SELECT COUNT(*) as count FROM coffees" },
    { label: "created_at range", sql: "SELECT MIN(created_at) as min_created, MAX(created_at) as max_created FROM coffees" },
    { label: "date range", sql: "SELECT MIN(date) as min_date, MAX(date) as max_date FROM coffees" },
    { label: "Coffees with date in last 30 days", sql: "SELECT COUNT(*) as count FROM coffees WHERE date >= datetime('now', '-30 days')" },
    { label: "Coffees with created_at in last 30 days", sql: "SELECT COUNT(*) as count FROM coffees WHERE created_at >= datetime('now', '-30 days')" },
    { label: "Oldest 10 by created_at", sql: "SELECT created_at, date, coffee, roaster FROM coffees ORDER BY created_at ASC LIMIT 10" },
    { label: "Newest 10 by created_at", sql: "SELECT created_at, date, coffee, roaster FROM coffees ORDER BY created_at DESC LIMIT 10" },
    { label: "Rows where created_at = date", sql: "SELECT COUNT(*) as count FROM coffees WHERE created_at = date" },
    { label: "Merch items", sql: "SELECT COUNT(*) as count FROM coffees WHERE is_merch = 1" },
  ];

  for (const q of queries) {
    console.log(`\n=== ${q.label} ===`);
    console.log(`SQL: ${q.sql}`);
    const result = await client.execute(q.sql);
    for (const row of result.rows) {
      console.log(JSON.stringify(row, null, 2));
    }
  }
}

main().catch(console.error);

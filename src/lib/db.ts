import { createClient, type Client } from "@libsql/client";
import { CoffeeEntry } from "./types";

let client: Client | null = null;

function getClient(): Client | null {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) return null;
  client = createClient({ url, authToken });
  return client;
}

export function hasTurso(): boolean {
  return !!process.env.TURSO_DATABASE_URL;
}

export async function initDb(): Promise<void> {
  const db = getClient();
  if (!db) return;
  await db.batch([
    `CREATE TABLE IF NOT EXISTS coffees (
      id TEXT PRIMARY KEY,
      roaster TEXT NOT NULL,
      coffee TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Unknown',
      process TEXT DEFAULT '',
      tasting_notes TEXT DEFAULT '[]',
      price TEXT DEFAULT '',
      date TEXT NOT NULL,
      link TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      is_merch INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_coffees_date ON coffees(date)`,
    `CREATE INDEX IF NOT EXISTS idx_coffees_type ON coffees(type)`,
    `CREATE INDEX IF NOT EXISTS idx_coffees_is_merch ON coffees(is_merch)`,
    `CREATE TABLE IF NOT EXISTS feed_health (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      healthy INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      last_refresh TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS feed_results (
      url TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'unknown',
      last_checked TEXT DEFAULT (datetime('now'))
    )`,
  ]);
}

export async function upsertCoffees(entries: CoffeeEntry[]): Promise<void> {
  const db = getClient();
  if (!db || entries.length === 0) return;

  // Batch in chunks of 50
  for (let i = 0; i < entries.length; i += 50) {
    const chunk = entries.slice(i, i + 50);
    const stmts = chunk.map((e) => ({
      sql: `INSERT OR REPLACE INTO coffees (id, roaster, coffee, type, process, tasting_notes, price, date, link, image_url, is_merch)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        e.id,
        e.roaster,
        e.coffee,
        e.type,
        e.process,
        JSON.stringify(e.tastingNotes),
        e.price,
        e.date,
        e.link,
        e.imageUrl,
        e.isMerch ? 1 : 0,
      ],
    }));
    await db.batch(stmts);
  }
}

export async function getCoffees(): Promise<CoffeeEntry[]> {
  const db = getClient();
  if (!db) return [];
  const result = await db.execute(
    `SELECT * FROM coffees WHERE date >= datetime('now', '-30 days') ORDER BY date DESC`
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    roaster: String(row.roaster),
    coffee: String(row.coffee),
    type: String(row.type) as CoffeeEntry["type"],
    process: String(row.process ?? ""),
    tastingNotes: JSON.parse(String(row.tasting_notes ?? "[]")),
    price: String(row.price ?? ""),
    date: String(row.date),
    link: String(row.link ?? ""),
    imageUrl: String(row.image_url ?? ""),
    isMerch: row.is_merch === 1,
  }));
}

export async function saveFeedHealth(healthy: number, failed: number, total: number): Promise<void> {
  const db = getClient();
  if (!db) return;
  await db.execute({
    sql: `INSERT OR REPLACE INTO feed_health (id, healthy, failed, total, last_refresh) VALUES (1, ?, ?, ?, datetime('now'))`,
    args: [healthy, failed, total],
  });
}

export async function getFeedHealth(): Promise<{ healthy: number; failed: number; total: number; lastRefresh: string } | null> {
  const db = getClient();
  if (!db) return null;
  const result = await db.execute(`SELECT * FROM feed_health WHERE id = 1`);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    healthy: Number(row.healthy),
    failed: Number(row.failed),
    total: Number(row.total),
    lastRefresh: String(row.last_refresh),
  };
}

export async function cleanOldEntries(): Promise<number> {
  const db = getClient();
  if (!db) return 0;
  const result = await db.execute(`DELETE FROM coffees WHERE date < datetime('now', '-30 days')`);
  return result.rowsAffected;
}

export async function saveFeedResults(results: { url: string; status: string }[]): Promise<void> {
  const db = getClient();
  if (!db || results.length === 0) return;
  for (let i = 0; i < results.length; i += 50) {
    const chunk = results.slice(i, i + 50);
    const stmts = chunk.map((r) => ({
      sql: `INSERT OR REPLACE INTO feed_results (url, status, last_checked) VALUES (?, ?, datetime('now'))`,
      args: [r.url, r.status],
    }));
    await db.batch(stmts);
  }
}

export async function getFeedResults(): Promise<Record<string, string>> {
  const db = getClient();
  if (!db) return {};
  const result = await db.execute(`SELECT url, status FROM feed_results`);
  const map: Record<string, string> = {};
  for (const row of result.rows) {
    map[String(row.url)] = String(row.status);
  }
  return map;
}

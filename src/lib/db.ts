import { createClient, type Client } from "@libsql/client";
import { CoffeeEntry, FeedSource, SiteUser } from "./types";
import seedSources from "../../data/sources.json";

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
    `CREATE INDEX IF NOT EXISTS idx_coffees_identity ON coffees(roaster, coffee, link, date)`,
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
    `CREATE TABLE IF NOT EXISTS feed_sources (
      url TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      website TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_feed_sources_enabled ON feed_sources(enabled)`,
    `CREATE TABLE IF NOT EXISTS site_users (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ]);

  const existing = await db.execute(`SELECT COUNT(*) as count FROM feed_sources`);
  const count = Number(existing.rows[0]?.count ?? 0);
  if (count === 0) {
    const seeds = (seedSources as FeedSource[]).map((s) => ({
      name: s.name,
      url: s.url,
      website: s.website || s.url,
      enabled: s.enabled !== false,
    }));
    if (seeds.length > 0) {
      await db.batch(
        seeds.map((s) => ({
          sql: `INSERT OR IGNORE INTO feed_sources (name, url, website, enabled) VALUES (?, ?, ?, ?)`,
          args: [s.name, s.url, s.website, s.enabled ? 1 : 0],
        }))
      );
    }
  }
}

export async function getFeedSources(enabledOnly = false): Promise<FeedSource[]> {
  const db = getClient();
  if (!db) return [];
  const where = enabledOnly ? "WHERE enabled = 1" : "";
  const result = await db.execute(`SELECT name, url, website, enabled FROM feed_sources ${where} ORDER BY name ASC`);
  return result.rows.map((row) => ({
    name: String(row.name),
    url: String(row.url),
    website: String(row.website),
    enabled: Number(row.enabled) === 1,
  }));
}

export async function upsertFeedSource(source: FeedSource): Promise<void> {
  const db = getClient();
  if (!db) return;
  await db.execute({
    sql: `INSERT INTO feed_sources (name, url, website, enabled, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(url) DO UPDATE SET
            name=excluded.name,
            website=excluded.website,
            enabled=excluded.enabled,
            updated_at=datetime('now')`,
    args: [source.name, source.url, source.website || source.url, source.enabled === false ? 0 : 1],
  });
}

export async function removeFeedSource(url: string): Promise<void> {
  const db = getClient();
  if (!db) return;
  await db.execute({ sql: `DELETE FROM feed_sources WHERE url = ?`, args: [url] });
}

export async function toggleFeedSource(url: string): Promise<void> {
  const db = getClient();
  if (!db) return;
  await db.execute({
    sql: `UPDATE feed_sources
          SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END,
              updated_at = datetime('now')
          WHERE url = ?`,
    args: [url],
  });
}

export async function upsertCoffees(entries: CoffeeEntry[]): Promise<void> {
  const db = getClient();
  if (!db || entries.length === 0) return;

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

export async function cleanOldFeedResults(): Promise<number> {
  const db = getClient();
  if (!db) return 0;
  const result = await db.execute(`DELETE FROM feed_results WHERE last_checked < datetime('now', '-30 days')`);
  return result.rowsAffected;
}

export async function cleanDuplicateCoffees(): Promise<number> {
  const db = getClient();
  if (!db) return 0;
  const result = await db.execute(`
    DELETE FROM coffees
    WHERE rowid NOT IN (
      SELECT MAX(rowid)
      FROM coffees
      GROUP BY roaster, coffee, link, date
    )
  `);
  return result.rowsAffected;
}

export async function cleanOldData(): Promise<{ coffees: number; feedResults: number; duplicateCoffees: number }> {
  const [coffees, feedResults, duplicateCoffees] = await Promise.all([
    cleanOldEntries(),
    cleanOldFeedResults(),
    cleanDuplicateCoffees(),
  ]);
  return { coffees, feedResults, duplicateCoffees };
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

// --- Site Users ---

export async function dbGetSiteUsers(): Promise<SiteUser[]> {
  const db = getClient();
  if (!db) return [];
  const result = await db.execute(`SELECT username, password_hash, salt, created_at FROM site_users ORDER BY created_at ASC`);
  return result.rows.map((row) => ({
    username: String(row.username),
    passwordHash: String(row.password_hash),
    salt: String(row.salt),
    createdAt: String(row.created_at),
  }));
}

export async function dbGetSiteUserByUsername(username: string): Promise<SiteUser | null> {
  const db = getClient();
  if (!db) return null;
  const result = await db.execute({ sql: `SELECT username, password_hash, salt, created_at FROM site_users WHERE username = ?`, args: [username] });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    username: String(row.username),
    passwordHash: String(row.password_hash),
    salt: String(row.salt),
    createdAt: String(row.created_at),
  };
}

export async function dbAddSiteUser(user: SiteUser): Promise<void> {
  const db = getClient();
  if (!db) return;
  await db.execute({
    sql: `INSERT OR REPLACE INTO site_users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)`,
    args: [user.username, user.passwordHash, user.salt, user.createdAt || new Date().toISOString()],
  });
}

export async function dbRemoveSiteUser(username: string): Promise<void> {
  const db = getClient();
  if (!db) return;
  await db.execute({ sql: `DELETE FROM site_users WHERE username = ?`, args: [username] });
}

// --- Site Settings ---

let siteProtectionCache: { value: boolean; ts: number } | null = null;

export async function dbGetSiteProtection(): Promise<boolean> {
  if (siteProtectionCache && Date.now() - siteProtectionCache.ts < 60_000) {
    return siteProtectionCache.value;
  }
  const db = getClient();
  if (!db) return false;
  const result = await db.execute({ sql: `SELECT value FROM site_settings WHERE key = ?`, args: ["site_protection_enabled"] });
  const enabled = result.rows.length > 0 && String(result.rows[0].value) === "true";
  siteProtectionCache = { value: enabled, ts: Date.now() };
  return enabled;
}

export async function dbSetSiteProtection(enabled: boolean): Promise<void> {
  const db = getClient();
  if (!db) return;
  await db.execute({
    sql: `INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)`,
    args: ["site_protection_enabled", enabled ? "true" : "false"],
  });
  siteProtectionCache = { value: enabled, ts: Date.now() };
}

export function invalidateSiteProtectionCache(): void {
  siteProtectionCache = null;
}

/**
 * Lightweight Edge-compatible protection check.
 * Queries Turso directly — no initDb(), no seed data, no heavy imports.
 * Safe to import from middleware.ts (Edge Runtime).
 */
import { createClient, type Client } from "@libsql/client/web";

let client: Client | null = null;

function getClient(): Client | null {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) return null;
  client = createClient({ url, authToken });
  return client;
}

export async function isProtectionEnabled(): Promise<boolean> {
  const db = getClient();
  if (!db) return false; // No Turso configured → no protection possible

  try {
    const result = await db.execute({
      sql: "SELECT value FROM site_settings WHERE key = ?",
      args: ["site_protection_enabled"],
    });
    return result.rows.length > 0 && String(result.rows[0].value) === "true";
  } catch {
    // Table may not exist yet, or Turso unreachable. Fail closed.
    return true;
  }
}

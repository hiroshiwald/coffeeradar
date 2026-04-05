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

export async function isProtectionEnabled(reqUrl?: string): Promise<boolean> {
  const db = getClient();
  if (db) {
    try {
      const result = await db.execute({
        sql: "SELECT value FROM site_settings WHERE key = ?",
        args: ["site_protection_enabled"],
      });
      return result.rows.length > 0 && String(result.rows[0].value) === "true";
    } catch {
      return true;
    }
  }

  if (!reqUrl) return false;
  try {
    const url = new URL("/api/auth/check-protection", reqUrl);
    if (url.hostname === "localhost") url.hostname = "127.0.0.1";
    
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();
    return data.enabled === true;
  } catch (error) {
    return false;
  }
}

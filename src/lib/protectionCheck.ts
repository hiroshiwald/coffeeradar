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
      // Table may not exist yet, or Turso unreachable. Fail closed.
      return true;
    }
  }

  // Fallback for in-memory mode (No Turso)
  // Edge runtime cannot read Node memory, so we query the API directly.
  if (!reqUrl) return false;

  try {
    const url = new URL("/api/auth/check-protection", reqUrl);
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();
    return data.enabled === true;
  } catch (error) {
    console.error("Failed to fetch protection state:", error);
    return false;
  }
}

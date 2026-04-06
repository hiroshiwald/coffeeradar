/**
 * Cookie-based session management using HMAC-SHA-256.
 * Upgradeable: swap to JWT or server-side sessions later.
 */

const COOKIE_NAME = "__coffeeradar_session";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.OWNER_PASSWORD;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET or OWNER_PASSWORD must be set in production");
  }
  return "dev-fallback-secret";
}

async function hmacSign(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionCookie(username: string): Promise<string> {
  const timestamp = Date.now().toString();
  const payload = `${username}:${timestamp}`;
  const signature = await hmacSign(payload);
  const value = `${payload}:${signature}`;
  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}

export async function validateSessionCookie(
  cookieValue: string
): Promise<{ valid: boolean; username: string }> {
  const parts = cookieValue.split(":");
  if (parts.length !== 3) return { valid: false, username: "" };

  const [username, timestamp, signature] = parts;
  const payload = `${username}:${timestamp}`;
  const expectedSignature = await hmacSign(payload);

  // Constant-time comparison
  if (signature.length !== expectedSignature.length) return { valid: false, username: "" };
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  if (mismatch !== 0) return { valid: false, username: "" };

  // Check expiry
  const age = Date.now() - parseInt(timestamp, 10);
  if (age > MAX_AGE_SECONDS * 1000 || age < 0) return { valid: false, username: "" };

  return { valid: true, username };
}

export function clearSessionCookie(): string {
  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function getSessionCookieName(): string {
  return COOKIE_NAME;
}

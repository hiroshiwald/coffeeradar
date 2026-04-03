/**
 * Password hashing utilities using Web Crypto API.
 * Upgradeable: swap internals to bcrypt/argon2 later without changing the interface.
 */

function hexEncode(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function hashPassword(
  password: string,
  existingSalt?: string
): Promise<{ hash: string; salt: string }> {
  const salt = existingSalt
    ? hexDecode(existingSalt)
    : crypto.getRandomValues(new Uint8Array(16));

  const encoder = new TextEncoder();
  const data = new Uint8Array([...salt, ...encoder.encode(password)]);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return {
    hash: hexEncode(hashBuffer),
    salt: hexEncode(salt.buffer as ArrayBuffer),
  };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);

  // Constant-time comparison
  if (hash.length !== expectedHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < hash.length; i++) {
    mismatch |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return mismatch === 0;
}

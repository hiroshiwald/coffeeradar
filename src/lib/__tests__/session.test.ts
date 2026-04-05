import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSessionCookie, validateSessionCookie, clearSessionCookie, getSessionCookieName } from "../session";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-secret-key");
  vi.stubEnv("NODE_ENV", "test");
});

describe("createSessionCookie", () => {
  it("returns a cookie string with the session name", async () => {
    const cookie = await createSessionCookie("alice");
    expect(cookie).toContain(getSessionCookieName());
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("includes the username in the cookie value", async () => {
    const cookie = await createSessionCookie("bob");
    expect(cookie).toContain("bob:");
  });
});

describe("validateSessionCookie", () => {
  it("validates a correctly signed cookie", async () => {
    const cookie = await createSessionCookie("alice");
    // Extract cookie value from "name=value; ..."
    const value = cookie.split("=").slice(1).join("=").split(";")[0];
    const result = await validateSessionCookie(value);
    expect(result.valid).toBe(true);
    expect(result.username).toBe("alice");
  });

  it("rejects a tampered signature", async () => {
    const cookie = await createSessionCookie("alice");
    const value = cookie.split("=").slice(1).join("=").split(";")[0];
    // Tamper with the signature (last part)
    const parts = value.split(":");
    parts[2] = "a".repeat(parts[2].length);
    const tampered = parts.join(":");
    const result = await validateSessionCookie(tampered);
    expect(result.valid).toBe(false);
  });

  it("rejects malformed cookie (wrong format)", async () => {
    const result = await validateSessionCookie("no-colons-here");
    expect(result.valid).toBe(false);
  });

  it("rejects cookie with wrong number of parts", async () => {
    const result = await validateSessionCookie("a:b");
    expect(result.valid).toBe(false);
  });
});

describe("clearSessionCookie", () => {
  it("sets Max-Age=0", () => {
    const cookie = clearSessionCookie();
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain(getSessionCookieName());
  });
});

describe("round-trip", () => {
  it("create then validate works", async () => {
    const cookie = await createSessionCookie("testuser");
    const value = cookie.split("=").slice(1).join("=").split(";")[0];
    const result = await validateSessionCookie(value);
    expect(result.valid).toBe(true);
    expect(result.username).toBe("testuser");
  });
});

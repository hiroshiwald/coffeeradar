import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createSessionCookie, getSessionCookieName } from "../session";

// Mock next/headers cookies()
const mockGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: mockGet })),
}));

// Helper: build a NextRequest-like object with a cookies bag
function fakeRequest(cookieValue?: string) {
  return {
    cookies: {
      get: (name: string) =>
        name === getSessionCookieName() && cookieValue
          ? { value: cookieValue }
          : undefined,
    },
  } as any;
}

// Helper: extract raw cookie value from the Set-Cookie header string
async function makeValidCookieValue(username: string): Promise<string> {
  const cookie = await createSessionCookie(username);
  return cookie.split("=").slice(1).join("=").split(";")[0];
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("SESSION_SECRET", "test-secret-key");
  vi.stubEnv("OWNER_PASSWORD", "test-owner-pass");
  vi.stubEnv("NODE_ENV", "test");
  mockGet.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("checkSiteAuth (server component)", () => {
  it("returns authorized when no OWNER_PASSWORD is set", async () => {
    vi.stubEnv("OWNER_PASSWORD", "");
    const { checkSiteAuth } = await import("../authGuard");
    const result = await checkSiteAuth();
    expect(result.authorized).toBe(true);
  });

  it("returns authorized when SITE_PROTECTION_ENABLED=false overrides", async () => {
    vi.stubEnv("SITE_PROTECTION_ENABLED", "false");
    const { checkSiteAuth } = await import("../authGuard");
    const result = await checkSiteAuth();
    expect(result.authorized).toBe(true);
  });

  it("returns authorized with valid cookie", async () => {
    const value = await makeValidCookieValue("alice");
    mockGet.mockReturnValue({ value });
    const { checkSiteAuth } = await import("../authGuard");
    const result = await checkSiteAuth();
    expect(result.authorized).toBe(true);
    expect(result.username).toBe("alice");
  });

  it("returns denied with no cookie", async () => {
    mockGet.mockReturnValue(undefined);
    const { checkSiteAuth } = await import("../authGuard");
    const result = await checkSiteAuth();
    expect(result.authorized).toBe(false);
  });

  it("returns denied with tampered cookie", async () => {
    const value = await makeValidCookieValue("alice");
    const parts = value.split(":");
    parts[2] = "a".repeat(parts[2].length);
    mockGet.mockReturnValue({ value: parts.join(":") });
    const { checkSiteAuth } = await import("../authGuard");
    const result = await checkSiteAuth();
    expect(result.authorized).toBe(false);
  });

  it("returns denied (fail-closed) when crypto throws", async () => {
    mockGet.mockReturnValue({ value: "alice:12345:sig" });
    const original = globalThis.crypto.subtle.importKey.bind(globalThis.crypto.subtle);
    try {
      globalThis.crypto.subtle.importKey = (() => { throw new Error("boom"); }) as any;
      const { checkSiteAuth } = await import("../authGuard");
      const result = await checkSiteAuth();
      expect(result.authorized).toBe(false);
    } finally {
      globalThis.crypto.subtle.importKey = original;
    }
  });
});

describe("checkSiteAuthFromRequest (API route)", () => {
  it("returns authorized when no OWNER_PASSWORD is set", async () => {
    vi.stubEnv("OWNER_PASSWORD", "");
    const { checkSiteAuthFromRequest } = await import("../authGuard");
    const result = await checkSiteAuthFromRequest(fakeRequest());
    expect(result.authorized).toBe(true);
  });

  it("returns authorized with valid cookie", async () => {
    const value = await makeValidCookieValue("bob");
    const { checkSiteAuthFromRequest } = await import("../authGuard");
    const result = await checkSiteAuthFromRequest(fakeRequest(value));
    expect(result.authorized).toBe(true);
    expect(result.username).toBe("bob");
  });

  it("returns denied with no cookie", async () => {
    const { checkSiteAuthFromRequest } = await import("../authGuard");
    const result = await checkSiteAuthFromRequest(fakeRequest());
    expect(result.authorized).toBe(false);
  });

  it("returns denied with tampered cookie", async () => {
    const value = await makeValidCookieValue("bob");
    const parts = value.split(":");
    parts[2] = "x".repeat(parts[2].length);
    const { checkSiteAuthFromRequest } = await import("../authGuard");
    const result = await checkSiteAuthFromRequest(fakeRequest(parts.join(":")));
    expect(result.authorized).toBe(false);
  });
});

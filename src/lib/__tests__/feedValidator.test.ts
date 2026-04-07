import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateFeedUrl } from "../feedValidator";

const COFFEE_ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Ethiopia Yirgacheffe Washed</title>
    <link href="https://example.com/p/ethiopia" />
    <published>${new Date().toISOString()}</published>
    <summary>A lovely single origin with notes of blueberry and chocolate.</summary>
  </entry>
</feed>`;

const MERCH_ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Logo T-Shirt</title>
    <link href="https://example.com/p/tshirt" />
    <published>${new Date().toISOString()}</published>
    <summary>Our new apparel</summary>
  </entry>
</feed>`;

function mockResponse(body: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => body,
  } as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("validateFeedUrl", () => {
  it("returns ok for a valid coffee feed", async () => {
    globalThis.fetch = vi.fn(async () => mockResponse(COFFEE_ATOM));
    const r = await validateFeedUrl("https://ex.com/feed");
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("ok");
    expect(r.coffeeEntryCount).toBeGreaterThan(0);
    expect(r.looksLikeCoffee).toBe(true);
  });

  it("flags http errors", async () => {
    globalThis.fetch = vi.fn(async () => mockResponse("", false, 404));
    const r = await validateFeedUrl("https://ex.com/404");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("http_error");
    expect(r.status).toBe(404);
  });

  it("flags non-feed responses", async () => {
    globalThis.fetch = vi.fn(async () => mockResponse("<html><body>hi</body></html>"));
    const r = await validateFeedUrl("https://ex.com/html");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("not_feed");
  });

  it("flags merch-only feeds", async () => {
    globalThis.fetch = vi.fn(async () => mockResponse(MERCH_ATOM));
    const r = await validateFeedUrl("https://ex.com/merch");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("merch_only");
    expect(r.entryCount).toBe(1);
    expect(r.coffeeEntryCount).toBe(0);
  });

  it("flags fetch failures", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await validateFeedUrl("https://ex.com/boom");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("fetch_failed");
  });
});

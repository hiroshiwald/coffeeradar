import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { triageFailedFeed, triageFailedFeeds } from "../feedTriage";

/**
 * Build a fetch stub that looks up (url, method) in a route table.
 * Each route value is either a Response-like object or a function that
 * throws (to simulate network errors).
 */
type RouteEntry =
  | {
      status: number;
      body?: string;
      headers?: Record<string, string>;
      finalUrl?: string;
    }
  | (() => never);

function makeFetch(routes: Record<string, RouteEntry | Record<string, RouteEntry>>) {
  const calls: { url: string; method: string }[] = [];

  const resolve = (url: string, method: string): RouteEntry | undefined => {
    const entry = routes[url];
    if (!entry) return undefined;
    // Entry might be method-specific: { GET: ..., HEAD: ... }
    if (
      typeof entry === "object" &&
      typeof entry !== "function" &&
      !("status" in entry)
    ) {
      return (entry as Record<string, RouteEntry>)[method];
    }
    return entry as RouteEntry;
  };

  const fn = vi.fn(async (input: string, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method });

    const route = resolve(url, method);
    if (!route) {
      throw new Error(`ENOTFOUND ${url}`);
    }
    if (typeof route === "function") {
      (route as () => never)();
    }

    const { status, body = "", headers = {}, finalUrl } = route as {
      status: number;
      body?: string;
      headers?: Record<string, string>;
      finalUrl?: string;
    };
    const headerMap = new Map<string, string>();
    for (const [k, v] of Object.entries(headers)) headerMap.set(k.toLowerCase(), v);

    return {
      ok: status >= 200 && status < 300,
      status,
      url: finalUrl ?? url,
      headers: {
        get: (k: string) => headerMap.get(k.toLowerCase()) ?? null,
      },
      text: async () => body,
    } as unknown as Response;
  });

  return { fn, calls };
}

const COFFEE_ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Ethiopia Yirgacheffe</title>
    <link href="https://ex.com/p/e" />
  </entry>
</feed>`;

const COFFEE_RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item><title>House Blend</title><link>https://ex.com/p/h</link></item>
</channel></rss>`;

const EMPTY_FEED = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"></feed>`;

const src = (overrides: Partial<{ name: string; url: string; website: string }> = {}) => ({
  name: "Roaster",
  url: "https://ex.com/old.xml",
  website: "https://ex.com",
  ...overrides,
});

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("triageFailedFeed — step 1 (site alive check)", () => {
  it("recommends deletion when fetch to root throws (DNS error)", async () => {
    const { fn } = makeFetch({}); // empty routes → all fetches throw
    globalThis.fetch = fn as unknown as typeof fetch;

    const r = await triageFailedFeed(src());
    expect(r.status).toBe("recommend_deletion");
    expect(r.diagnostics.siteAlive).toBe(false);
    expect(r.discoveredFeedUrl).toBeUndefined();
  });

  it("recommends deletion when root returns 404", async () => {
    const { fn } = makeFetch({
      "https://ex.com": { status: 404 },
    });
    globalThis.fetch = fn as unknown as typeof fetch;

    const r = await triageFailedFeed(src());
    expect(r.status).toBe("recommend_deletion");
    expect(r.diagnostics.rootStatus).toBe(404);
  });

  it("recommends deletion when root redirects to unrelated host", async () => {
    const { fn } = makeFetch({
      "https://ex.com": { status: 200, body: "<html></html>", finalUrl: "https://parked.com/" },
    });
    globalThis.fetch = fn as unknown as typeof fetch;

    const r = await triageFailedFeed(src());
    expect(r.status).toBe("recommend_deletion");
    expect(r.diagnostics.rootFinalHost).toBe("parked.com");
  });

  it("treats www redirect as same domain (still alive)", async () => {
    // Root alive but no feed routes → should fall through to manual_review
    const { fn } = makeFetch({
      "https://ex.com": {
        status: 200,
        body: "<html></html>",
        finalUrl: "https://www.ex.com/",
      },
    });
    globalThis.fetch = fn as unknown as typeof fetch;

    const r = await triageFailedFeed(src());
    expect(r.status).toBe("manual_review");
    expect(r.diagnostics.siteAlive).toBe(true);
  });

  it("recommends deletion on persistent 5xx", async () => {
    const { fn } = makeFetch({
      "https://ex.com": { status: 503 },
    });
    globalThis.fetch = fn as unknown as typeof fetch;

    const r = await triageFailedFeed(src());
    expect(r.status).toBe("recommend_deletion");
  });
});

describe("triageFailedFeed — step 2 (feed reconstruction)", () => {
  it("finds a feed via /collections/all.atom (static path)", async () => {
    const routes: Record<string, RouteEntry> = {
      "https://ex.com": { status: 200, body: "<html></html>" },
      // HEAD returns xml content-type so probe proceeds to GET
      "https://ex.com/collections/all.atom": {
        status: 200,
        body: COFFEE_ATOM,
        headers: { "content-type": "application/atom+xml; charset=utf-8" },
      },
    };
    const { fn } = makeFetch(routes);
    globalThis.fetch = fn as unknown as typeof fetch;

    const r = await triageFailedFeed(src());
    expect(r.status).toBe("recommend_add");
    expect(r.discoveredFeedUrl).toBe("https://ex.com/collections/all.atom");
    expect(r.discoveredWebsite).toBe("https://ex.com");
  });

  it("finds a feed via an anchor keyword crawl (/shop → /shop.rss)", async () => {
    // No static path works except /shop (discovered from the anchor). Return
    // 404 for the static paths before /shop so we fall through to the anchor.
    const rootHtml = `
      <html><body>
        <nav>
          <a href="/about">About</a>
          <a href="/shop">Shop</a>
          <a href="https://other.com/products">Offsite</a>
        </nav>
      </body></html>`;
    const routes: Record<string, RouteEntry> = {
      "https://ex.com": { status: 200, body: rootHtml },
      "https://ex.com/shop.rss": {
        status: 200,
        body: COFFEE_RSS,
        headers: { "content-type": "application/rss+xml" },
      },
    };
    const { fn, calls } = makeFetch(routes);
    globalThis.fetch = fn as unknown as typeof fetch;

    const r = await triageFailedFeed(src());
    expect(r.status).toBe("recommend_add");
    expect(r.discoveredFeedUrl).toBe("https://ex.com/shop.rss");

    // Confirm the offsite anchor was filtered out.
    const fetched = calls.map((c) => c.url);
    expect(fetched.every((u) => !u.startsWith("https://other.com"))).toBe(true);
  });

  it("rejects a candidate with wrong content-type even if body is XML", async () => {
    const routes: Record<string, RouteEntry> = {
      "https://ex.com": { status: 200, body: "<html></html>" },
      // Serves XML body as text/html → should be rejected
      "https://ex.com/collections/all.atom": {
        status: 200,
        body: COFFEE_ATOM,
        headers: { "content-type": "text/html" },
      },
    };
    const { fn } = makeFetch(routes);
    globalThis.fetch = fn as unknown as typeof fetch;

    const r = await triageFailedFeed(src());
    expect(r.status).toBe("manual_review");
  });

  it("rejects a feed with zero entries", async () => {
    const routes: Record<string, RouteEntry> = {
      "https://ex.com": { status: 200, body: "<html></html>" },
      "https://ex.com/collections/all.atom": {
        status: 200,
        body: EMPTY_FEED,
        headers: { "content-type": "application/atom+xml" },
      },
    };
    const { fn } = makeFetch(routes);
    globalThis.fetch = fn as unknown as typeof fetch;

    const r = await triageFailedFeed(src());
    expect(r.status).toBe("manual_review");
  });

  it("returns manual_review when alive but no probes succeed", async () => {
    const routes: Record<string, RouteEntry> = {
      "https://ex.com": { status: 200, body: "<html></html>" },
    };
    const { fn } = makeFetch(routes);
    globalThis.fetch = fn as unknown as typeof fetch;

    const r = await triageFailedFeed(src());
    expect(r.status).toBe("manual_review");
    expect(r.diagnostics.siteAlive).toBe(true);
    expect(r.diagnostics.feedUrlsProbed.length).toBeGreaterThan(0);
  });

  it("short-circuits on first successful candidate", async () => {
    const routes: Record<string, RouteEntry> = {
      "https://ex.com": { status: 200, body: "<html></html>" },
      "https://ex.com/collections/all.atom": {
        status: 200,
        body: COFFEE_ATOM,
        headers: { "content-type": "application/atom+xml" },
      },
      "https://ex.com/collections/coffee.atom": {
        status: 200,
        body: COFFEE_ATOM,
        headers: { "content-type": "application/atom+xml" },
      },
    };
    const { fn, calls } = makeFetch(routes);
    globalThis.fetch = fn as unknown as typeof fetch;

    await triageFailedFeed(src());

    // Should not have probed /collections/coffee.atom because
    // /collections/all.atom already returned a valid feed.
    const coffeeAtomCalls = calls.filter(
      (c) => c.url === "https://ex.com/collections/coffee.atom",
    );
    expect(coffeeAtomCalls.length).toBe(0);
  });
});

describe("triageFailedFeeds (batch)", () => {
  it("returns one TriageResult per source in order", async () => {
    const { fn } = makeFetch({
      "https://a.com": { status: 404 },
      "https://b.com": { status: 200, body: "<html></html>" },
      "https://c.com": { status: 200, body: "<html></html>" },
      "https://c.com/collections/all.atom": {
        status: 200,
        body: COFFEE_ATOM,
        headers: { "content-type": "application/atom+xml" },
      },
    });
    globalThis.fetch = fn as unknown as typeof fetch;

    const results = await triageFailedFeeds([
      src({ name: "A", url: "https://a.com/f.xml", website: "https://a.com" }),
      src({ name: "B", url: "https://b.com/f.xml", website: "https://b.com" }),
      src({ name: "C", url: "https://c.com/f.xml", website: "https://c.com" }),
    ]);

    expect(results).toHaveLength(3);
    expect(results[0].name).toBe("A");
    expect(results[0].status).toBe("recommend_deletion");
    expect(results[1].name).toBe("B");
    expect(results[1].status).toBe("manual_review");
    expect(results[2].name).toBe("C");
    expect(results[2].status).toBe("recommend_add");
    expect(results[2].discoveredFeedUrl).toBe("https://c.com/collections/all.atom");
  });
});

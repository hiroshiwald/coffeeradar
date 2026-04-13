import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock sourceStore before importing feedFetcher
vi.mock("../sourceStore", () => ({
  listEnabledMasterSources: vi.fn(),
}));

vi.mock("../db", () => ({
  hasTurso: vi.fn(() => false),
  getFeedHttpMeta: vi.fn(async () => ({})),
}));

import { fetchAllFeeds, __resetFeedMetaCacheForTests } from "../feedFetcher";
import { listEnabledMasterSources } from "../sourceStore";
import { hasTurso } from "../db";

const ATOM_FEED = (title: string, date: string) => `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>${title}</title>
    <link href="https://example.com/${title.toLowerCase().replace(/\s/g, "-")}" />
    <published>${date}</published>
    <summary>A great coffee</summary>
  </entry>
</feed>`;

interface MockEntry {
  body: string | null;
  status?: number;
  headers?: Record<string, string>;
}

function mockFetch(responses: Record<string, string | null | MockEntry>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    const raw = responses[url];

    // Support both simple string format and detailed MockEntry format
    const entry: MockEntry | undefined =
      raw === null ? { body: null }
        : typeof raw === "string" ? { body: raw }
          : raw;

    if (!entry || entry.body === null) {
      return {
        ok: false,
        status: entry?.status ?? 500,
        headers: new Headers(),
        text: async () => "",
      } as unknown as Response;
    }

    const status = entry.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(entry.headers ?? {}),
      text: async () => entry.body!,
    } as unknown as Response;
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  __resetFeedMetaCacheForTests();
  vi.mocked(hasTurso).mockReturnValue(false);
});

describe("fetchAllFeeds", () => {
  it("fetches feeds and returns results", async () => {
    const sources = [
      { name: "Roaster A", url: "https://a.com/feed", website: "https://a.com" },
      { name: "Roaster B", url: "https://b.com/feed", website: "https://b.com" },
    ];
    vi.mocked(listEnabledMasterSources).mockResolvedValue(sources);

    const now = new Date().toISOString();
    globalThis.fetch = mockFetch({
      "https://a.com/feed": ATOM_FEED("Ethiopia Washed", now),
      "https://b.com/feed": ATOM_FEED("Colombia Natural", now),
    });

    const result = await fetchAllFeeds();
    expect(result.healthy).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(2);
    expect(result.coffees).toHaveLength(2);
  });

  it("counts failed feeds correctly", async () => {
    const sources = [
      { name: "Good", url: "https://good.com/feed", website: "https://good.com" },
      { name: "Bad", url: "https://bad.com/feed", website: "https://bad.com" },
    ];
    vi.mocked(listEnabledMasterSources).mockResolvedValue(sources);

    globalThis.fetch = mockFetch({
      "https://good.com/feed": ATOM_FEED("Coffee", new Date().toISOString()),
      "https://bad.com/feed": null,
    });

    const result = await fetchAllFeeds();
    expect(result.healthy).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("deduplicates entries by ID", async () => {
    const sources = [
      { name: "Same Roaster", url: "https://a.com/feed", website: "https://a.com" },
      { name: "Same Roaster", url: "https://a.com/feed2", website: "https://a.com" },
    ];
    vi.mocked(listEnabledMasterSources).mockResolvedValue(sources);

    const now = new Date().toISOString();
    const sameFeed = ATOM_FEED("Same Coffee", now);
    globalThis.fetch = mockFetch({
      "https://a.com/feed": sameFeed,
      "https://a.com/feed2": sameFeed,
    });

    const result = await fetchAllFeeds();
    // Same roaster + same link + same date = same stable ID, so deduplicated
    expect(result.coffees).toHaveLength(1);
  });

  it("filters out entries older than 30 days", async () => {
    const sources = [
      { name: "Old Roaster", url: "https://old.com/feed", website: "https://old.com" },
    ];
    vi.mocked(listEnabledMasterSources).mockResolvedValue(sources);

    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    globalThis.fetch = mockFetch({
      "https://old.com/feed": ATOM_FEED("Old Coffee", oldDate),
    });

    const result = await fetchAllFeeds();
    expect(result.coffees).toHaveLength(0);
    expect(result.healthy).toBe(1);
  });

  it("keeps entries within last 30 days", async () => {
    const sources = [
      { name: "Recent Roaster", url: "https://recent.com/feed", website: "https://recent.com" },
    ];
    vi.mocked(listEnabledMasterSources).mockResolvedValue(sources);

    const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    globalThis.fetch = mockFetch({
      "https://recent.com/feed": ATOM_FEED("Recent Coffee", recentDate),
    });

    const result = await fetchAllFeeds();
    expect(result.coffees).toHaveLength(1);
  });

  it("excludes entries with unparseable dates", async () => {
    const sources = [
      { name: "Bad Date", url: "https://bad.com/feed", website: "https://bad.com" },
    ];
    vi.mocked(listEnabledMasterSources).mockResolvedValue(sources);

    globalThis.fetch = mockFetch({
      "https://bad.com/feed": ATOM_FEED("Bad Date Coffee", "not-a-date"),
    });

    const result = await fetchAllFeeds();
    expect(result.coffees).toHaveLength(0);
    expect(result.healthy).toBe(1);
  });

  it("handles empty source list", async () => {
    vi.mocked(listEnabledMasterSources).mockResolvedValue([]);

    const result = await fetchAllFeeds();
    expect(result.coffees).toHaveLength(0);
    expect(result.healthy).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(0);
  });

  it("counts 304 responses as healthy with zero entries", async () => {
    const sources = [
      { name: "Cached", url: "https://cached.com/feed", website: "https://cached.com" },
    ];
    vi.mocked(listEnabledMasterSources).mockResolvedValue(sources);

    globalThis.fetch = mockFetch({
      "https://cached.com/feed": { body: "", status: 304 },
    });

    const result = await fetchAllFeeds();
    expect(result.healthy).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.coffees).toHaveLength(0);
    expect(result.feedResults[0].notModified).toBe(true);
  });

  it("sends conditional headers when metadata is cached", async () => {
    const sources = [
      { name: "Roaster", url: "https://r.com/feed", website: "https://r.com" },
    ];
    vi.mocked(listEnabledMasterSources).mockResolvedValue(sources);

    const now = new Date().toISOString();
    // First fetch returns Last-Modified and ETag headers
    globalThis.fetch = mockFetch({
      "https://r.com/feed": {
        body: ATOM_FEED("Coffee", now),
        headers: { "Last-Modified": "Tue, 01 Jan 2030 00:00:00 GMT", "ETag": '"abc123"' },
      },
    });

    await fetchAllFeeds();

    // Second fetch — should send conditional headers
    const fetchSpy = mockFetch({
      "https://r.com/feed": { body: "", status: 304 },
    });
    globalThis.fetch = fetchSpy;

    await fetchAllFeeds();

    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = callInit.headers as Record<string, string>;
    expect(headers["If-Modified-Since"]).toBe("Tue, 01 Jan 2030 00:00:00 GMT");
    expect(headers["If-None-Match"]).toBe('"abc123"');
  });

  it("captures Last-Modified and ETag from 200 responses", async () => {
    const sources = [
      { name: "Roaster", url: "https://r.com/feed", website: "https://r.com" },
    ];
    vi.mocked(listEnabledMasterSources).mockResolvedValue(sources);

    globalThis.fetch = mockFetch({
      "https://r.com/feed": {
        body: ATOM_FEED("Coffee", new Date().toISOString()),
        headers: { "Last-Modified": "Wed, 15 Jan 2030 12:00:00 GMT", "ETag": '"xyz789"' },
      },
    });

    const result = await fetchAllFeeds();
    const feedResult = result.feedResults.find((r) => r.url === "https://r.com/feed");
    expect(feedResult?.lastModified).toBe("Wed, 15 Jan 2030 12:00:00 GMT");
    expect(feedResult?.etag).toBe('"xyz789"');
  });

  it("works normally for feeds without conditional headers", async () => {
    const sources = [
      { name: "Plain", url: "https://plain.com/feed", website: "https://plain.com" },
    ];
    vi.mocked(listEnabledMasterSources).mockResolvedValue(sources);

    globalThis.fetch = mockFetch({
      "https://plain.com/feed": ATOM_FEED("Coffee", new Date().toISOString()),
    });

    const result = await fetchAllFeeds();
    expect(result.healthy).toBe(1);
    expect(result.coffees).toHaveLength(1);
    const feedResult = result.feedResults[0];
    expect(feedResult.lastModified).toBeUndefined();
    expect(feedResult.etag).toBeUndefined();
    expect(feedResult.notModified).toBeUndefined();
  });
});

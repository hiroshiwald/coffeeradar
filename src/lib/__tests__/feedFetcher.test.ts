import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock sourceStore before importing feedFetcher
vi.mock("../sourceStore", () => ({
  listEnabledMasterSources: vi.fn(),
}));

import { fetchAllFeeds } from "../feedFetcher";
import { listEnabledMasterSources } from "../sourceStore";

const ATOM_FEED = (title: string, date: string) => `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>${title}</title>
    <link href="https://example.com/${title.toLowerCase().replace(/\s/g, "-")}" />
    <published>${date}</published>
    <summary>A great coffee</summary>
  </entry>
</feed>`;

function mockFetch(responses: Record<string, string | null>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : String(input);
    const body = responses[url];
    if (body === null || body === undefined) {
      return { ok: false, text: async () => "" } as Response;
    }
    return {
      ok: true,
      text: async () => body,
    } as Response;
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
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

  it("includes entries with old publication dates", async () => {
    const sources = [
      { name: "Old Roaster", url: "https://old.com/feed", website: "https://old.com" },
    ];
    vi.mocked(listEnabledMasterSources).mockResolvedValue(sources);

    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    globalThis.fetch = mockFetch({
      "https://old.com/feed": ATOM_FEED("Old Coffee", oldDate),
    });

    const result = await fetchAllFeeds();
    expect(result.coffees).toHaveLength(1);
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
});

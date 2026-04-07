import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../feedDiscovery", () => ({
  discoverFeedFromStoreUrl: vi.fn(),
}));
vi.mock("../feedValidator", () => ({
  validateFeedUrl: vi.fn(),
}));

import { suggestReplacementFeed } from "../feedSuggestion";
import { discoverFeedFromStoreUrl } from "../feedDiscovery";
import { validateFeedUrl } from "../feedValidator";

beforeEach(() => {
  vi.resetAllMocks();
});

const failing = {
  ok: false as const,
  reason: "http_error" as const,
  entryCount: 0,
  coffeeEntryCount: 0,
  looksLikeCoffee: false,
};
const passing = {
  ok: true as const,
  reason: "ok" as const,
  entryCount: 5,
  coffeeEntryCount: 4,
  looksLikeCoffee: true,
};

describe("suggestReplacementFeed", () => {
  it("skips discovery when current feed is still valid", async () => {
    vi.mocked(validateFeedUrl).mockResolvedValueOnce(passing);
    const r = await suggestReplacementFeed({ name: "A", url: "https://a.com/feed", website: "https://a.com" });
    expect(r.candidate).toBeUndefined();
    expect(r.reason).toBe("current_feed_still_valid");
    expect(discoverFeedFromStoreUrl).not.toHaveBeenCalled();
  });

  it("returns a candidate whose preflight passes", async () => {
    vi.mocked(validateFeedUrl)
      .mockResolvedValueOnce(failing) // current
      .mockResolvedValueOnce(passing); // candidate preflight
    vi.mocked(discoverFeedFromStoreUrl).mockResolvedValueOnce({
      ok: true,
      website: "https://a.com",
      feedUrl: "https://a.com/collections/all.atom",
      method: "common-path",
      message: "found",
    });

    const r = await suggestReplacementFeed({ name: "A", url: "https://a.com/old.xml", website: "https://a.com" });
    expect(r.candidate?.feedUrl).toBe("https://a.com/collections/all.atom");
    expect(r.preflight?.ok).toBe(true);
  });

  it("rejects candidates that fail preflight", async () => {
    vi.mocked(validateFeedUrl)
      .mockResolvedValueOnce(failing) // current
      .mockResolvedValueOnce(failing); // candidate
    vi.mocked(discoverFeedFromStoreUrl).mockResolvedValue({
      ok: true,
      website: "https://a.com",
      feedUrl: "https://a.com/feed",
      method: "common-path",
      message: "found",
    });

    const r = await suggestReplacementFeed({ name: "A", url: "https://a.com/old.xml", website: "https://a.com" });
    expect(r.candidate).toBeUndefined();
    expect(r.reason).toBe("no_candidate_found");
  });
});

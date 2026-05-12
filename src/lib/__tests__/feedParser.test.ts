import { describe, it, expect } from "vitest";
import { parseFeed, parseAtomFeed, parseRssFeed } from "../feedParser";

const MINIMAL_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Roaster</title>
  <entry>
    <title>Ethiopia Yirgacheffe Washed</title>
    <link href="https://example.com/products/ethiopia" />
    <published>2026-03-01T00:00:00Z</published>
    <summary>Tasting notes: blueberry, jasmine, bergamot</summary>
  </entry>
</feed>`;

const MINIMAL_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Roaster</title>
    <item>
      <title>Colombia Huila Natural</title>
      <link>https://example.com/products/colombia</link>
      <pubDate>Sat, 01 Mar 2026 00:00:00 GMT</pubDate>
      <description>Rich chocolate and cherry notes</description>
    </item>
  </channel>
</rss>`;

const SHOPIFY_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:s="http://jadedpixel.com/-/spec/shopify">
  <title>Shopify Roaster</title>
  <entry>
    <title>Kenya AA</title>
    <link href="https://shop.example.com/products/kenya-aa" />
    <published>2026-03-15T00:00:00Z</published>
    <summary>A bright Kenyan coffee</summary>
    <s:price>24.00</s:price>
    <s:tag>Blackcurrant</s:tag>
    <s:tag>Tomato</s:tag>
    <s:tag>Brown Sugar</s:tag>
    <s:type>Coffee</s:type>
    <s:image><s:src>https://cdn.shopify.com/kenya.jpg</s:src></s:image>
  </entry>
</feed>`;

describe("parseAtomFeed", () => {
  it("parses a minimal Atom feed", () => {
    const entries = parseAtomFeed(MINIMAL_ATOM, "Test Roaster", "https://example.com");
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.roaster).toBe("Test Roaster");
    expect(e.coffee).toBe("Ethiopia Yirgacheffe Washed");
    expect(e.link).toBe("https://example.com/products/ethiopia");
    expect(e.type).toBe("Single Origin");
    expect(e.process).toBe("Washed");
    expect(e.id).toBeTruthy();
  });

  it("extracts tasting notes from summary", () => {
    const entries = parseAtomFeed(MINIMAL_ATOM, "Test Roaster", "https://example.com");
    expect(entries[0].tastingNotes).toContain("Blueberry");
    expect(entries[0].tastingNotes).toContain("Jasmine");
    expect(entries[0].tastingNotes).toContain("Bergamot");
  });

  it("returns empty array for malformed XML", () => {
    expect(parseAtomFeed("not xml at all", "R", "https://x.com")).toEqual([]);
    expect(parseAtomFeed("<feed></feed>", "R", "https://x.com")).toEqual([]);
  });
});

describe("parseRssFeed", () => {
  it("parses a minimal RSS feed", () => {
    const entries = parseRssFeed(MINIMAL_RSS, "Test Roaster", "https://example.com");
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.roaster).toBe("Test Roaster");
    expect(e.coffee).toBe("Colombia Huila Natural");
    expect(e.link).toBe("https://example.com/products/colombia");
    expect(e.type).toBe("Single Origin");
    expect(e.process).toBe("Natural");
  });

  it("extracts notes from description", () => {
    const entries = parseRssFeed(MINIMAL_RSS, "Test Roaster", "https://example.com");
    expect(entries[0].tastingNotes).toContain("Chocolate");
    expect(entries[0].tastingNotes).toContain("Cherry");
  });

  it("returns empty array for malformed RSS", () => {
    expect(parseRssFeed("garbage", "R", "https://x.com")).toEqual([]);
    expect(parseRssFeed("<rss><channel></channel></rss>", "R", "https://x.com")).toEqual([]);
  });
});

describe("parseFeed (auto-detection)", () => {
  it("detects Atom feeds", () => {
    const entries = parseFeed(MINIMAL_ATOM, "R", "https://x.com");
    expect(entries).toHaveLength(1);
  });

  it("detects RSS feeds", () => {
    const entries = parseFeed(MINIMAL_RSS, "R", "https://x.com");
    expect(entries).toHaveLength(1);
  });

  it("returns empty for empty input", () => {
    expect(parseFeed("", "R", "https://x.com")).toEqual([]);
  });
});

describe("Shopify feed parsing", () => {
  it("extracts Shopify price", () => {
    const entries = parseAtomFeed(SHOPIFY_ATOM, "Shopify Roaster", "https://shop.example.com");
    expect(entries).toHaveLength(1);
    expect(entries[0].price).toBe("$24.00");
  });

  it("extracts Shopify tags as tasting notes", () => {
    const entries = parseAtomFeed(SHOPIFY_ATOM, "Shopify Roaster", "https://shop.example.com");
    expect(entries[0].tastingNotes).toContain("Blackcurrant");
    expect(entries[0].tastingNotes).toContain("Tomato");
    expect(entries[0].tastingNotes).toContain("Brown Sugar");
  });

  it("extracts Shopify image", () => {
    const entries = parseAtomFeed(SHOPIFY_ATOM, "Shopify Roaster", "https://shop.example.com");
    expect(entries[0].imageUrl).toBe("https://cdn.shopify.com/kenya.jpg");
  });

  it("detects type from Shopify product type and title", () => {
    const entries = parseAtomFeed(SHOPIFY_ATOM, "Shopify Roaster", "https://shop.example.com");
    expect(entries[0].type).toBe("Single Origin");
  });
});

describe("stable IDs", () => {
  it("generates consistent IDs for same input", () => {
    const a = parseAtomFeed(MINIMAL_ATOM, "R", "https://x.com");
    const b = parseAtomFeed(MINIMAL_ATOM, "R", "https://x.com");
    expect(a[0].id).toBe(b[0].id);
  });

  it("generates different IDs for different roasters", () => {
    const a = parseAtomFeed(MINIMAL_ATOM, "Roaster A", "https://x.com");
    const b = parseAtomFeed(MINIMAL_ATOM, "Roaster B", "https://x.com");
    expect(a[0].id).not.toBe(b[0].id);
  });
});

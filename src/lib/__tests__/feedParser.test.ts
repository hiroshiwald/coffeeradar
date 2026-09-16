import { describe, it, expect } from "vitest";
import { parseFeed, parseAtomFeed, parseRssFeed } from "../feedParser";
import { THEORY_TASTING_NOTES_ATOM } from "./fixtures/realFeedSamples";

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
      <description>Tasting notes: chocolate and cherry</description>
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

describe("parseAtomFeed against real Shopify CDATA", () => {
  // Regression: prior to the stripHtml step in feedParser.ts, the
  // <strong>Tasting Notes:</strong> wrapper made the note-capture regex
  // fail because [^.<\n]+ required ≥1 non-< char immediately after the
  // colon, and the next char was always < (start of </strong>).
  it("extracts notes from Theory's <strong>-wrapped Tasting Notes label", () => {
    const entries = parseAtomFeed(
      THEORY_TASTING_NOTES_ATOM,
      "Theory Coffee Roasters",
      "https://theorycoffee.com",
    );
    expect(entries).toHaveLength(1);
    const notes = entries[0].tastingNotes;
    expect(notes).toContain("Lemon");
    expect(notes).toContain("Rose");
    expect(notes).toContain("Jasmine");
    expect(notes).toContain("Raspberry");
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

// A feed that omits a usable per-entry link must not yield a link that another
// roaster's feed could also produce: buildStableId hashes the link into the
// coffee id, and cleanDuplicateCoffees groups rows by it.
const EMPTY_LINK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Roaster</title>
    <item>
      <title>Ethiopia Yirgacheffe</title>
      <link></link>
      <pubDate>not a date</pubDate>
      <description>Tasting notes: chocolate</description>
    </item>
  </channel>
</rss>`;

const EMPTY_LINK_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Roaster</title>
  <entry>
    <title>Ethiopia Yirgacheffe</title>
    <link href="" />
    <published>not a date</published>
    <summary>Tasting notes: chocolate</summary>
  </entry>
</feed>`;

describe("link fallback keeps entries roaster-specific", () => {
  it("falls back to the website when an RSS link element is empty", () => {
    const [entry] = parseRssFeed(EMPTY_LINK_RSS, "Aka Coffee", "https://aka.coffee");
    expect(entry.link).toBe("https://aka.coffee");
  });

  it("falls back to the website when an Atom href is empty", () => {
    const [entry] = parseAtomFeed(EMPTY_LINK_ATOM, "Aka Coffee", "https://aka.coffee");
    expect(entry.link).toBe("https://aka.coffee");
  });

  it("gives two roasters distinct ids and links for an identical linkless entry", () => {
    const [a] = parseRssFeed(EMPTY_LINK_RSS, "Aka Coffee", "https://aka.coffee");
    const [b] = parseRssFeed(EMPTY_LINK_RSS, "Luna Coffee", "https://lunacoffee.ca");

    // Same title, same unparseable date, no link. Before the fallback existed
    // both produced link "" and collided in the dedupe GROUP BY.
    expect(a.coffee).toBe(b.coffee);
    expect(a.date).toBe(b.date);
    expect(a.link).not.toBe(b.link);
    expect(a.id).not.toBe(b.id);
  });
});

// Relative links are legal in Atom (href is an IRI reference). They must land
// on the roaster's domain and stay distinct per product: a feed that puts two
// products with the same title and date behind different relative paths must
// not have them share a link, and therefore a coffee id.
const RELATIVE_LINK_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Roaster</title>
  <entry>
    <title>Ethiopia</title>
    <link href="/products/ethiopia-washed" />
    <published>2026-03-01T00:00:00Z</published>
  </entry>
  <entry>
    <title>Ethiopia</title>
    <link href="/products/ethiopia-natural" />
    <published>2026-03-01T00:00:00Z</published>
  </entry>
</feed>`;

const RELATIVE_LINK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Roaster</title>
    <item>
      <title>Ethiopia</title>
      <link>/products/ethiopia</link>
      <pubDate>Sat, 01 Mar 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe("relative links resolve on the roaster's domain", () => {
  it("resolves an Atom href against the website", () => {
    const entries = parseAtomFeed(RELATIVE_LINK_ATOM, "Aka Coffee", "https://aka.coffee/collections/all");
    expect(entries[0].link).toBe("https://aka.coffee/products/ethiopia-washed");
  });

  it("resolves an RSS link against the website", () => {
    const [entry] = parseRssFeed(RELATIVE_LINK_RSS, "Aka Coffee", "https://aka.coffee/collections/all");
    expect(entry.link).toBe("https://aka.coffee/products/ethiopia");
  });

  it("keeps two same-titled products with different relative links distinct", () => {
    const [a, b] = parseAtomFeed(RELATIVE_LINK_ATOM, "Aka Coffee", "https://aka.coffee/collections/all");
    expect(a.coffee).toBe(b.coffee);
    expect(a.date).toBe(b.date);
    expect(a.link).not.toBe(b.link);
    expect(a.id).not.toBe(b.id);
  });
});

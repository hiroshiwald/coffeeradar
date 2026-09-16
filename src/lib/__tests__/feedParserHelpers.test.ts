import { describe, it, expect } from "vitest";
import {
  decodeHtml,
  deepString,
  deepText,
  extractImage,
  extractImageFromHtml,
  extractProductType,
  extractShopifyPrice,
  extractShopifyTags,
  stripHtml,
  resolveLink,
} from "../feedParserHelpers";
import { extractPrice } from "../heuristics";

describe("decodeHtml", () => {
  it("decodes the common HTML entities", () => {
    expect(decodeHtml("&lt;b&gt;hi&lt;/b&gt;")).toBe("<b>hi</b>");
    expect(decodeHtml("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(decodeHtml("&quot;hi&quot;")).toBe('"hi"');
    expect(decodeHtml("it&#39;s")).toBe("it's");
  });
});

describe("stripHtml", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtml("<strong>Tasting Notes:</strong> Lemon, Rose"))
      .toBe("Tasting Notes: Lemon, Rose");
  });

  it("turns adjacent tags into single space", () => {
    expect(stripHtml("<p>a</p><p>b</p>")).toBe("a b");
  });

  it("is a no-op on plain text", () => {
    expect(stripHtml("Tasting notes: chocolate")).toBe("Tasting notes: chocolate");
  });

  it("handles self-closing and attribute-heavy tags", () => {
    expect(stripHtml('foo<br/>bar<img src="x.jpg" />baz')).toBe("foo bar baz");
  });

  it("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });
});

describe("deepString", () => {
  it("returns the string itself", () => {
    expect(deepString("foo")).toBe("foo");
  });

  it("returns the first array element", () => {
    expect(deepString(["a", "b"])).toBe("a");
  });

  it("digs into known keys", () => {
    expect(deepString({ "s:src": "https://x/y.jpg" })).toBe("https://x/y.jpg");
    expect(deepString({ "@_href": "https://x/h" })).toBe("https://x/h");
  });

  it("returns first http url found in object values", () => {
    expect(deepString({ a: "no", b: { x: "https://example.com/img.jpg" } })).toBe(
      "https://example.com/img.jpg",
    );
  });

  it("returns empty string for falsy", () => {
    expect(deepString(null)).toBe("");
    expect(deepString(undefined)).toBe("");
  });
});

describe("deepText", () => {
  it("flattens objects with #text", () => {
    expect(deepText({ "#text": "hello" })).toBe("hello");
  });

  it("joins array values", () => {
    expect(deepText(["a", "b"])).toBe("a b");
  });

  it("falls back to concatenated values", () => {
    expect(deepText({ a: "x", b: "y" })).toBe("x y");
  });

  it("returns empty string for nullish", () => {
    expect(deepText(null)).toBe("");
    expect(deepText(undefined)).toBe("");
  });
});

describe("extractImageFromHtml", () => {
  it("finds og:image meta", () => {
    const html = `<meta property="og:image" content="https://cdn/og.jpg" />`;
    expect(extractImageFromHtml(html)).toBe("https://cdn/og.jpg");
  });

  it("finds img src", () => {
    expect(extractImageFromHtml(`<img src="https://x/y.png">`)).toBe("https://x/y.png");
  });

  it("finds data-src lazy images", () => {
    expect(extractImageFromHtml(`<img data-src="https://x/y.webp">`)).toBe("https://x/y.webp");
  });

  it("returns empty string when nothing matches", () => {
    expect(extractImageFromHtml("<p>nothing</p>")).toBe("");
  });
});

describe("extractImage", () => {
  it("prefers s:image", () => {
    const entry = { "s:image": { "s:src": "https://shopify/img.jpg" } };
    expect(extractImage(entry)).toBe("https://shopify/img.jpg");
  });

  it("falls back to media:content @_url", () => {
    const entry = { "media:content": { "@_url": "https://media/x.jpg" } };
    expect(extractImage(entry)).toBe("https://media/x.jpg");
  });

  it("falls back to media:thumbnail @_url", () => {
    const entry = { "media:thumbnail": [{ "@_url": "https://thumb/x.jpg" }] };
    expect(extractImage(entry)).toBe("https://thumb/x.jpg");
  });

  it("falls back to itunes:image @_href", () => {
    const entry = { "itunes:image": { "@_href": "https://i/x.jpg" } };
    expect(extractImage(entry)).toBe("https://i/x.jpg");
  });

  it("scans content HTML as a last resort", () => {
    const entry = { content: `<img src="https://html/x.jpg">` };
    expect(extractImage(entry)).toBe("https://html/x.jpg");
  });

  it("returns empty string when nothing found", () => {
    expect(extractImage({})).toBe("");
  });
});

describe("extractShopifyTags / extractProductType", () => {
  it("returns tag list", () => {
    expect(extractShopifyTags({ "s:tag": ["ethiopia", "natural"] })).toEqual([
      "ethiopia",
      "natural",
    ]);
  });

  it("normalizes single tag to array", () => {
    expect(extractShopifyTags({ "s:tag": "single" })).toEqual(["single"]);
  });

  it("returns [] when missing", () => {
    expect(extractShopifyTags({})).toEqual([]);
  });

  it("reads s:type", () => {
    expect(extractProductType({ "s:type": "Coffee" })).toBe("Coffee");
  });
});

describe("extractShopifyPrice", () => {
  it("uses direct price keys", () => {
    expect(extractShopifyPrice({ "g:price": "$22.00" }, "ignored", extractPrice)).toBe("$22.00");
  });

  it("falls back to s:variant prices", () => {
    const entry = { "s:variant": [{ "s:price": "$18.50" }] };
    expect(extractShopifyPrice(entry, "ignored", extractPrice)).toBe("$18.50");
  });

  it("falls back to all-text scan", () => {
    expect(extractShopifyPrice({}, "Bag $24.00", extractPrice)).toBe("$24.00");
  });

  it("returns empty when no price anywhere", () => {
    expect(extractShopifyPrice({}, "no price", extractPrice)).toBe("");
  });
});

describe("resolveLink", () => {
  const WEBSITE = "https://aka.coffee/collections/all";

  it("keeps a plain http(s) string", () => {
    expect(resolveLink("https://aka.coffee/p/1", WEBSITE)).toBe("https://aka.coffee/p/1");
  });

  it("keeps an href from an object", () => {
    expect(resolveLink({ "@_href": "https://aka.coffee/p/2" }, WEBSITE)).toBe("https://aka.coffee/p/2");
  });

  it("takes the first usable href from an array", () => {
    const raw = [{ "@_rel": "self" }, { "@_href": "https://aka.coffee/p/3" }];
    expect(resolveLink(raw, WEBSITE)).toBe("https://aka.coffee/p/3");
  });

  // The cases below are why this helper exists. Each one used to yield a value
  // that is identical across roasters, which collides coffee ids and lets the
  // dedupe pass delete one roaster's row in favour of another's.
  it("falls back when the element is empty", () => {
    expect(resolveLink("", WEBSITE)).toBe(WEBSITE);
  });

  it("falls back when the link is missing", () => {
    expect(resolveLink(undefined, WEBSITE)).toBe(WEBSITE);
    expect(resolveLink(null, WEBSITE)).toBe(WEBSITE);
  });

  it("falls back for an object with no usable href", () => {
    expect(resolveLink({ "@_rel": "alternate" }, WEBSITE)).toBe(WEBSITE);
    expect(resolveLink({ "@_href": "" }, WEBSITE)).toBe(WEBSITE);
  });

  it("falls back for a non-http scheme", () => {
    expect(resolveLink("javascript:alert(1)", WEBSITE)).toBe(WEBSITE);
    expect(resolveLink("mailto:hi@aka.coffee", WEBSITE)).toBe(WEBSITE);
    expect(resolveLink({ "@_href": "javascript:alert(1)" }, WEBSITE)).toBe(WEBSITE);
  });

  // A relative path is still a distinct product. Collapsing it to the website
  // would give every product in the feed the same link, and two with the same
  // title and date would then share a coffee id and overwrite each other.
  it("resolves a relative path against the website", () => {
    expect(resolveLink("/products/relative", WEBSITE)).toBe("https://aka.coffee/products/relative");
    expect(resolveLink({ "@_href": "/p/4" }, WEBSITE)).toBe("https://aka.coffee/p/4");
    expect(resolveLink("p/5", WEBSITE)).toBe("https://aka.coffee/collections/p/5");
  });

  it("keeps an absolute link byte for byte, since the coffee id hashes it", () => {
    expect(resolveLink("https://aka.coffee", WEBSITE)).toBe("https://aka.coffee");
    expect(resolveLink("https://aka.coffee/p/Ä?x=1#f", WEBSITE)).toBe("https://aka.coffee/p/Ä?x=1#f");
  });

  it("reads the element text when the link carries attributes", () => {
    const raw = { "#text": "https://aka.coffee/p/6", "@_rel": "alternate" };
    expect(resolveLink(raw, WEBSITE)).toBe("https://aka.coffee/p/6");
  });

  it("falls back when the website itself cannot serve as a base", () => {
    expect(resolveLink("/products/x", "not a url")).toBe("not a url");
  });

  it("falls back for an array with nothing usable", () => {
    expect(resolveLink([{ "@_rel": "self" }, ""], WEBSITE)).toBe(WEBSITE);
    expect(resolveLink([], WEBSITE)).toBe(WEBSITE);
  });

  it("never returns a value two roasters could share", () => {
    const a = resolveLink("", "https://aka.coffee/collections/all");
    const b = resolveLink("", "https://lunacoffee.ca/collections/all");
    expect(a).not.toBe(b);
    const relA = resolveLink("/products/x", "https://aka.coffee/collections/all");
    const relB = resolveLink("/products/x", "https://lunacoffee.ca/collections/all");
    expect(relA).not.toBe(relB);
  });
});

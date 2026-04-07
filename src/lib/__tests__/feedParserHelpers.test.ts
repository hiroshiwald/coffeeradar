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

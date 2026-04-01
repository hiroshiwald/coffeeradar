import { XMLParser } from "fast-xml-parser";
import { CoffeeEntry } from "./types";
import { detectType, detectProcess, extractNotes, extractPrice, isMerchandise } from "./heuristics";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
});

function deepString(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) return deepString(val[0]);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    // Try common keys
    for (const key of ["s:src", "#text", "@_src", "src", "@_href"]) {
      if (obj[key]) return deepString(obj[key]);
    }
    // Try first string value
    for (const v of Object.values(obj)) {
      const s = deepString(v);
      if (s.startsWith("http")) return s;
    }
  }
  return String(val);
}

function extractImage(entry: Record<string, unknown>): string {
  // Shopify s:image element — may contain nested s:src
  const sImage = entry["s:image"];
  if (sImage) {
    const items = Array.isArray(sImage) ? sImage : [sImage];
    for (const item of items) {
      const url = deepString(item);
      if (url && url.startsWith("http")) return url;
    }
  }

  // Try s:variant images
  const sVariant = entry["s:variant"];
  if (sVariant) {
    const variants = Array.isArray(sVariant) ? sVariant : [sVariant];
    for (const v of variants) {
      if (typeof v === "object" && v !== null) {
        const vObj = v as Record<string, unknown>;
        if (vObj["s:image"]) {
          const url = deepString(vObj["s:image"]);
          if (url && url.startsWith("http")) return url;
        }
      }
    }
  }

  // Common RSS/Atom media tags
  const mediaContent = entry["media:content"];
  if (mediaContent) {
    const items = Array.isArray(mediaContent) ? mediaContent : [mediaContent];
    for (const item of items) {
      if (typeof item === "object" && item !== null) {
        const url = String((item as Record<string, unknown>)["@_url"] ?? "");
        if (url.startsWith("http")) return url;
      }
    }
  }

  const mediaThumbnail = entry["media:thumbnail"];
  if (mediaThumbnail) {
    const items = Array.isArray(mediaThumbnail) ? mediaThumbnail : [mediaThumbnail];
    for (const item of items) {
      if (typeof item === "object" && item !== null) {
        const url = String((item as Record<string, unknown>)["@_url"] ?? "");
        if (url.startsWith("http")) return url;
      }
    }
  }

  const googleImage = entry["g:image_link"] ?? entry["image_link"];
  if (googleImage) {
    const url = deepString(googleImage);
    if (url.startsWith("http")) return url;
  }

  // Image from content/summary HTML
  const rawContent = typeof entry.content === "object" && entry.content !== null
    ? String((entry.content as Record<string, unknown>)["#text"] ?? "")
    : String(entry.content ?? "");
  const rawSummary = String(entry.summary ?? "");
  const html = `${rawContent} ${rawSummary}`
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

  const imgMatch = html.match(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp|avif|gif)[^"']*)/i)
    || html.match(/src=["']([^"']*(?:cdn\.shopify|amazonaws|cloudinary|imgix)[^"']*)/i);
  if (imgMatch) return imgMatch[1];

  return "";
}

function extractShopifyTags(entry: Record<string, unknown>): string[] {
  const tags = entry["s:tag"];
  if (!tags) return [];
  const arr = Array.isArray(tags) ? tags : [tags];
  return arr.map((t) => String(t)).filter(Boolean);
}

function extractProductType(entry: Record<string, unknown>): string {
  const pt = entry["s:type"] ?? entry["s:product-type"];
  if (pt) return String(pt);
  return "";
}

export function parseAtomFeed(xml: string, roaster: string, website: string): CoffeeEntry[] {
  try {
    const doc = parser.parse(xml);
    const feed = doc.feed;
    if (!feed?.entry) return [];
    const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];

    return entries.map((e: Record<string, unknown>, i: number) => {
      const title = String(e.title ?? "");
      const summary = String(e.summary ?? "");
      const content = typeof e.content === "object" && e.content !== null
        ? String((e.content as Record<string, unknown>)["#text"] ?? "")
        : String(e.content ?? "");

      const shopifyTags = extractShopifyTags(e);
      const productType = extractProductType(e);
      const allText = `${title} ${summary} ${content} ${shopifyTags.join(" ")} ${productType}`;

      // Extract price from s:price or s:variant or content
      let price = "";
      const sPrice = e["s:price"] ?? (e as Record<string, unknown>)["s:variant"];
      if (sPrice) {
        const sp = Array.isArray(sPrice) ? sPrice[0] : sPrice;
        const spVal = typeof sp === "object" && sp !== null
          ? String((sp as Record<string, unknown>)["s:price"] ?? sp)
          : String(sp);
        price = extractPrice(spVal);
      }
      if (!price) price = extractPrice(allText);

      const link = typeof e.link === "object" && e.link !== null
        ? String((e.link as Record<string, unknown>)["@_href"] ?? website)
        : website;

      return {
        id: `${roaster}-${i}-${Date.now()}`,
        roaster,
        coffee: title,
        type: detectType(allText),
        process: detectProcess(allText),
        tastingNotes: extractNotes(allText, shopifyTags),
        price,
        date: String(e.published ?? e.updated ?? ""),
        link,
        imageUrl: extractImage(e),
        isMerch: isMerchandise(title, productType, shopifyTags),
      };
    });
  } catch {
    return [];
  }
}

export function parseRssFeed(xml: string, roaster: string, website: string): CoffeeEntry[] {
  try {
    const doc = parser.parse(xml);
    const channel = doc.rss?.channel;
    if (!channel?.item) return [];
    const items = Array.isArray(channel.item) ? channel.item : [channel.item];

    return items.map((item: Record<string, unknown>, i: number) => {
      const title = String(item.title ?? "");
      const desc = String(item.description ?? "");
      const allText = `${title} ${desc}`;

      // Try to get image from description or enclosure
      let imageUrl = "";
      const enclosure = item.enclosure as Record<string, unknown> | undefined;
      if (enclosure?.["@_url"]) imageUrl = String(enclosure["@_url"]);
      if (!imageUrl) {
        const imgMatch = desc.match(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)/i);
        if (imgMatch) imageUrl = imgMatch[1];
      }

      return {
        id: `${roaster}-rss-${i}-${Date.now()}`,
        roaster,
        coffee: title,
        type: detectType(allText),
        process: detectProcess(allText),
        tastingNotes: extractNotes(allText, []),
        price: extractPrice(allText),
        date: String(item.pubDate ?? ""),
        link: String(item.link ?? website),
        imageUrl,
        isMerch: isMerchandise(title, "", []),
      };
    });
  } catch {
    return [];
  }
}

export function parseFeed(xml: string, roaster: string, website: string): CoffeeEntry[] {
  const trimmed = xml.trim();
  if (trimmed.includes("<feed")) return parseAtomFeed(trimmed, roaster, website);
  if (trimmed.includes("<rss")) return parseRssFeed(trimmed, roaster, website);
  const atom = parseAtomFeed(trimmed, roaster, website);
  if (atom.length > 0) return atom;
  return parseRssFeed(trimmed, roaster, website);
}

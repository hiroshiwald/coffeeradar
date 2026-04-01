import { createHash } from "crypto";
import { XMLParser } from "fast-xml-parser";
import { CoffeeEntry } from "./types";
import { detectType, detectProcess, extractNotes, extractPrice, isMerchandise } from "./heuristics";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
});

function decodeHtml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

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

function deepText(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  if (Array.isArray(val)) {
    return val.map(deepText).filter(Boolean).join(" ");
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const preferred = ["#text", "@_value", "content:encoded", "description", "summary", "title"];
    for (const k of preferred) {
      if (obj[k]) {
        const out = deepText(obj[k]);
        if (out) return out;
      }
    }
    return Object.values(obj).map(deepText).filter(Boolean).join(" ");
  }
  return "";
}

function extractImageFromHtml(html: string): string {
  const normalized = decodeHtml(html);
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["'](https?:\/\/[^"']+)["']/i,
    /<img[^>]+src=["'](https?:\/\/[^"']+)["']/i,
    /<img[^>]+data-src=["'](https?:\/\/[^"']+)["']/i,
    /<img[^>]+srcset=["'](https?:\/\/[^"'\s,]+)[^"']*["']/i,
    /src=["']([^"']*(?:cdn\.shopify|amazonaws|cloudinary|imgix)[^"']*)["']/i,
  ];
  for (const p of patterns) {
    const m = normalized.match(p);
    if (m?.[1]) return m[1];
  }
  return "";
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

  const itunesImage = entry["itunes:image"];
  if (itunesImage && typeof itunesImage === "object" && itunesImage !== null) {
    const href = String((itunesImage as Record<string, unknown>)["@_href"] ?? "");
    if (href.startsWith("http")) return href;
  }

  const googleImage = entry["g:image_link"] ?? entry["image_link"];
  if (googleImage) {
    const url = deepString(googleImage);
    if (url.startsWith("http")) return url;
  }

  // Image from content/summary HTML
  const html = `${deepText(entry.content)} ${deepText(entry.summary)} ${deepText(entry["content:encoded"])}`;
  const htmlImage = extractImageFromHtml(html);
  if (htmlImage) return htmlImage;

  return "";
}

function extractShopifyPrice(entry: Record<string, unknown>, allText: string): string {
  const directKeys = ["g:price", "price", "woocommerce:price", "p:price"];
  for (const key of directKeys) {
    if (!entry[key]) continue;
    const parsed = extractPrice(deepText(entry[key]));
    if (parsed) return parsed;
  }

  const directPrice = entry["s:price"];
  if (directPrice) {
    const directParsed = extractPrice(deepString(directPrice));
    if (directParsed) return directParsed;
  }

  const variantsRaw = entry["s:variant"];
  if (variantsRaw) {
    const variants = Array.isArray(variantsRaw) ? variantsRaw : [variantsRaw];
    for (const variant of variants) {
      if (typeof variant !== "object" || variant === null) continue;
      const vObj = variant as Record<string, unknown>;
      const vPrice = vObj["s:price"];
      if (!vPrice) continue;
      const parsed = extractPrice(deepString(vPrice));
      if (parsed) return parsed;
    }
  }

  return extractPrice(allText);
}

function extractShopifyTags(entry: Record<string, unknown>): string[] {
  const tags = entry["s:tag"];
  if (!tags) return [];
  const arr = Array.isArray(tags) ? tags : [tags];
  return arr.map((t) => String(t)).filter(Boolean);
}


function buildStableId(roaster: string, urlOrTitle: string, publishedAt: string, fallback: string): string {
  const normalized = [roaster.trim().toLowerCase(), urlOrTitle.trim().toLowerCase(), publishedAt.trim(), fallback.trim().toLowerCase()].join("|");
  return createHash("sha1").update(normalized).digest("hex");
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
      const title = deepText(e.title);
      const summary = deepText(e.summary);
      const content = deepText(e.content);
      const encoded = deepText(e["content:encoded"]);

      const shopifyTags = extractShopifyTags(e);
      const productType = extractProductType(e);
      const allText = `${title} ${summary} ${content} ${encoded} ${shopifyTags.join(" ")} ${productType}`;

      // Extract price from s:price or s:variant or content
      const price = extractShopifyPrice(e, allText);

      let link = website;
      if (Array.isArray(e.link)) {
        const firstHref = e.link
          .map((x) => (typeof x === "object" && x !== null ? String((x as Record<string, unknown>)["@_href"] ?? "") : ""))
          .find((x) => x.startsWith("http"));
        if (firstHref) link = firstHref;
      } else if (typeof e.link === "object" && e.link !== null) {
        link = String((e.link as Record<string, unknown>)["@_href"] ?? website);
      } else if (typeof e.link === "string" && e.link.startsWith("http")) {
        link = e.link;
      }

      const publishedAt = String(e.published ?? e.updated ?? "");
      const stableId = buildStableId(roaster, link, publishedAt, title || String(i));

      return {
        id: stableId,
        roaster,
        coffee: title,
        type: detectType(allText),
        process: detectProcess(allText),
        tastingNotes: extractNotes(allText, shopifyTags),
        price,
        date: publishedAt,
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
      const title = deepText(item.title);
      const desc = deepText(item.description);
      const encoded = deepText(item["content:encoded"]);
      const allText = `${title} ${desc} ${encoded} ${deepText(item["g:price"])} ${deepText(item.price)}`;

      // Try to get image from description or enclosure
      let imageUrl = "";
      const enclosure = item.enclosure as Record<string, unknown> | undefined;
      if (enclosure?.["@_url"]) imageUrl = String(enclosure["@_url"]);
      if (!imageUrl) {
        imageUrl = extractImage(item);
      }

      const publishedAt = String(item.pubDate ?? "");
      const link = String(item.link ?? website);
      const stableId = buildStableId(roaster, link, publishedAt, title || String(i));

      return {
        id: stableId,
        roaster,
        coffee: title,
        type: detectType(allText),
        process: detectProcess(allText),
        tastingNotes: extractNotes(allText, []),
        price: extractPrice(allText),
        date: publishedAt,
        link,
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

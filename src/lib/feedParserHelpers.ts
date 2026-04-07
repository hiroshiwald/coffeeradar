// Pure helpers used by feedParser.ts. Kept separate so they can be unit-tested
// without pulling in the XMLParser/feed orchestration.

export function decodeHtml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function deepString(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) return deepString(val[0]);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    for (const key of ["s:src", "#text", "@_src", "src", "@_href"]) {
      if (obj[key]) return deepString(obj[key]);
    }
    for (const v of Object.values(obj)) {
      const s = deepString(v);
      if (s.startsWith("http")) return s;
    }
  }
  return String(val);
}

export function deepText(val: unknown): string {
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

export function extractImageFromHtml(html: string): string {
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

// Try a series of attribute lookups (e.g. media:content @_url) for the first
// http(s) URL.
function urlFromAttribute(items: unknown, attr: string): string {
  if (!items) return "";
  const arr = Array.isArray(items) ? items : [items];
  for (const item of arr) {
    if (typeof item === "object" && item !== null) {
      const url = String((item as Record<string, unknown>)[attr] ?? "");
      if (url.startsWith("http")) return url;
    }
  }
  return "";
}

export function extractImage(entry: Record<string, unknown>): string {
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

  const fromMediaContent = urlFromAttribute(entry["media:content"], "@_url");
  if (fromMediaContent) return fromMediaContent;

  const fromMediaThumb = urlFromAttribute(entry["media:thumbnail"], "@_url");
  if (fromMediaThumb) return fromMediaThumb;

  const fromItunes = urlFromAttribute(entry["itunes:image"], "@_href");
  if (fromItunes) return fromItunes;

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

export function extractShopifyTags(entry: Record<string, unknown>): string[] {
  const tags = entry["s:tag"];
  if (!tags) return [];
  const arr = Array.isArray(tags) ? tags : [tags];
  return arr.map((t) => String(t)).filter(Boolean);
}

export function extractProductType(entry: Record<string, unknown>): string {
  const pt = entry["s:type"] ?? entry["s:product-type"];
  if (pt) return String(pt);
  return "";
}

// Generic attempt at extracting a price from common feed shapes. Falls back
// to scanning all of `allText` so we still find prices in HTML descriptions.
export function extractShopifyPrice(
  entry: Record<string, unknown>,
  allText: string,
  parsePrice: (text: string) => string,
): string {
  const directKeys = ["g:price", "price", "woocommerce:price", "p:price"];
  for (const key of directKeys) {
    if (!entry[key]) continue;
    const parsed = parsePrice(deepText(entry[key]));
    if (parsed) return parsed;
  }

  const directPrice = entry["s:price"];
  if (directPrice) {
    const directParsed = parsePrice(deepString(directPrice));
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
      const parsed = parsePrice(deepString(vPrice));
      if (parsed) return parsed;
    }
  }

  return parsePrice(allText);
}

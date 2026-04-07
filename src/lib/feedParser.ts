import { createHash } from "crypto";
import { XMLParser } from "fast-xml-parser";
import { CoffeeEntry } from "./types";
import { detectType, detectProcess, extractNotes, extractPrice, isMerchandise } from "./heuristics";
import {
  deepText,
  extractImage,
  extractProductType,
  extractShopifyPrice,
  extractShopifyTags,
} from "./feedParserHelpers";
import { logger } from "./logger";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
});

function buildStableId(roaster: string, urlOrTitle: string, publishedAt: string, fallback: string): string {
  const normalized = [
    roaster.trim().toLowerCase(),
    urlOrTitle.trim().toLowerCase(),
    publishedAt.trim(),
    fallback.trim().toLowerCase(),
  ].join("|");
  return createHash("sha1").update(normalized).digest("hex");
}

function resolveAtomLink(rawLink: unknown, fallback: string): string {
  if (Array.isArray(rawLink)) {
    const firstHref = rawLink
      .map((x) =>
        typeof x === "object" && x !== null
          ? String((x as Record<string, unknown>)["@_href"] ?? "")
          : "",
      )
      .find((x) => x.startsWith("http"));
    if (firstHref) return firstHref;
  } else if (typeof rawLink === "object" && rawLink !== null) {
    return String((rawLink as Record<string, unknown>)["@_href"] ?? fallback);
  } else if (typeof rawLink === "string" && rawLink.startsWith("http")) {
    return rawLink;
  }
  return fallback;
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

      const price = extractShopifyPrice(e, allText, extractPrice);
      const link = resolveAtomLink(e.link, website);
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
  } catch (err) {
    logger.warn("feedParser: failed to parse atom feed", { roaster, err });
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
  } catch (err) {
    logger.warn("feedParser: failed to parse rss feed", { roaster, err });
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

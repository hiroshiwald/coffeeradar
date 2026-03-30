import { XMLParser } from "fast-xml-parser";
import { CoffeeEntry } from "./types";
import { detectType, detectProcess, extractNotes, extractPrice } from "./heuristics";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

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
      const allText = `${title} ${summary} ${content}`;

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
        tastingNotes: extractNotes(allText),
        price,
        date: String(e.published ?? e.updated ?? ""),
        link,
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

      return {
        id: `${roaster}-rss-${i}-${Date.now()}`,
        roaster,
        coffee: title,
        type: detectType(allText),
        process: detectProcess(allText),
        tastingNotes: extractNotes(allText),
        price: extractPrice(allText),
        date: String(item.pubDate ?? ""),
        link: String(item.link ?? website),
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
  // Try both
  const atom = parseAtomFeed(trimmed, roaster, website);
  if (atom.length > 0) return atom;
  return parseRssFeed(trimmed, roaster, website);
}

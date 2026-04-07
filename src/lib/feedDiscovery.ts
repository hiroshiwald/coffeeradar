import { XMLParser } from "fast-xml-parser";
import { logger } from "./logger";

const COMMON_FEED_PATHS = [
  "/feed",
  "/rss",
  "/atom.xml",
  "/feeds/all.atom.xml",
  "/blogs/news.atom",
  "/collections/all.atom",
  "/collections/coffee.atom",
  "/products.atom",
  "/?format=rss",
  "/?feed=rss2",
  "/index.xml",
];

function normalizeBaseUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  u.search = "";
  return u.toString().replace(/\/$/, "");
}

function maybeAbsolute(base: string, link: string): string {
  try {
    return new URL(link, base).toString();
  } catch {
    return link;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "CoffeeRadar/1.0",
        Accept: "text/html,application/xml,application/atom+xml,application/rss+xml,text/xml",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      logger.warn("feedDiscovery: non-ok response", { url, status: res.status });
      return null;
    }
    return await res.text();
  } catch (err) {
    logger.warn("feedDiscovery: fetch failed", { url, err });
    return null;
  }
}

function looksLikeFeed(body: string): boolean {
  const sample = body.slice(0, 5000).toLowerCase();
  return sample.includes("<rss") || sample.includes("<feed") || sample.includes("<rdf:rdf");
}

function isValidFeedUrl(url: string, body: string): boolean {
  if (!looksLikeFeed(body)) return false;
  try {
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(body);
    return !!(parsed?.rss || parsed?.feed || parsed?.["rdf:RDF"] || parsed?.["rdf:rdf"] || url.includes(".atom") || url.includes("rss"));
  } catch (err) {
    logger.warn("feedDiscovery: invalid feed XML", { url, err });
    return false;
  }
}

function discoverFeedLinksFromHtml(html: string, baseUrl: string): string[] {
  const matches = [...html.matchAll(/<link[^>]+(?:type=["'](?:application\/rss\+xml|application\/atom\+xml|application\/xml|text\/xml)["'])[^>]*>/gi)];
  const hrefs: string[] = [];
  for (const m of matches) {
    const tag = m[0];
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) hrefs.push(maybeAbsolute(baseUrl, href));
  }
  return hrefs;
}

export async function discoverFeedFromStoreUrl(storeUrl: string): Promise<{
  ok: boolean;
  website: string;
  feedUrl?: string;
  method?: string;
  message: string;
}> {
  const website = normalizeBaseUrl(storeUrl);

  const homeHtml = await fetchText(website);
  if (homeHtml) {
    const discoveredLinks = discoverFeedLinksFromHtml(homeHtml, website);
    for (const link of discoveredLinks) {
      const candidateBody = await fetchText(link);
      if (candidateBody && isValidFeedUrl(link, candidateBody)) {
        return { ok: true, website, feedUrl: link, method: "html-autodiscovery", message: `Discovered feed via HTML link: ${link}` };
      }
    }
  }

  for (const path of COMMON_FEED_PATHS) {
    const candidate = maybeAbsolute(`${website}/`, path);
    const body = await fetchText(candidate);
    if (body && isValidFeedUrl(candidate, body)) {
      return { ok: true, website, feedUrl: candidate, method: "common-path", message: `Discovered feed via common path: ${candidate}` };
    }
  }

  return {
    ok: false,
    website,
    message: "Could not automatically discover a valid RSS/Atom feed from that store URL.",
  };
}

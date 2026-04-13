import { XMLParser } from "fast-xml-parser";
import { FeedSource } from "./types";
import { FEED_TIMEOUT_MS } from "./constants";
import { logger } from "./logger";

/**
 * Two-step triage for failed feed sources:
 *
 *   Step 1: Is the roaster site still alive? (root-URL reachability check)
 *   Step 2: If alive, try to reconstruct a working feed by crawling common
 *           product-listing paths (and anchors whose text matches a keyword
 *           whitelist) and probing feed extensions on each candidate page.
 *
 * Returns one of three statuses per source:
 *   - "recommend_deletion" → site is dead, admin should delete
 *   - "recommend_add"      → a working feed was found, admin should approve
 *   - "manual_review"      → site is alive but no feed could be reconstructed
 *
 * This module deliberately does NOT call discoverFeedFromStoreUrl from
 * feedDiscovery.ts (which remains the autodiscovery path used elsewhere).
 * The triage pipeline is product-page-first, whereas autodiscovery is
 * feed-path-first, so they are kept separate.
 */

export type TriageStatus = "recommend_deletion" | "recommend_add" | "manual_review";

export interface TriageDiagnostics {
  siteAlive: boolean;
  rootStatus?: number;
  rootFinalHost?: string;
  productPagesProbed: string[];
  feedUrlsProbed: string[];
}

export interface TriageResult {
  site: string;
  sourceUrl: string;
  name: string;
  status: TriageStatus;
  recommendation: string;
  discoveredFeedUrl?: string;
  discoveredWebsite?: string;
  diagnostics: TriageDiagnostics;
}

const STATIC_PRODUCT_PATHS = [
  "/collections/all",
  "/collections/coffee",
  "/collections/coffees",
  "/shop",
  "/products",
  "/store",
];

const LINK_KEYWORDS = ["all coffees", "coffees", "shop", "products", "collections"];

// Order matters: probe dotted extensions before path segments so Shopify-style
// `/collections/all.atom` is discovered before `/collections/all/feed`.
const FEED_SUFFIXES = [".atom", ".rss", "/feed", "/rss", "/atom"];

const MAX_PRODUCT_CANDIDATES = 12;

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": "CoffeeRadar/1.0",
  Accept:
    "text/html,application/xhtml+xml,application/xml,application/atom+xml,application/rss+xml,text/xml",
};

interface FetchOutcome {
  response: Response | null;
  threw: boolean;
}

async function safeFetch(url: string, method: "GET" | "HEAD" = "GET"): Promise<FetchOutcome> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
    const res = await fetch(url, {
      method,
      headers: DEFAULT_HEADERS,
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    return { response: res, threw: false };
  } catch (err) {
    logger.warn("feedTriage: fetch threw", { url, method, err });
    return { response: null, threw: true };
  }
}

function normalizeRootUrl(url: string): string | null {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    u.pathname = "/";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function rootOf(source: FeedSource): string | null {
  if (source.website) {
    const w = normalizeRootUrl(source.website);
    if (w) return w;
  }
  return normalizeRootUrl(source.url);
}

/**
 * Registrable-domain comparison with a cheap `www.` strip. A proper PSL
 * implementation would be more accurate, but the cost of a false positive
 * here is just one extra dismiss click for the admin.
 */
function sameRegistrableDomain(a: string, b: string): boolean {
  const strip = (h: string) => h.toLowerCase().replace(/^www\./, "");
  return strip(a) === strip(b);
}

interface SiteAliveResult {
  alive: boolean;
  reason: string;
  rootStatus?: number;
  rootFinalHost?: string;
  rootHtml?: string;
}

/**
 * Classify a response after hard-dead and 5xx statuses have been ruled out.
 * Resolves the final host from the redirect chain and handles offsite
 * redirects, auth-gated responses, other non-ok statuses, and success.
 */
async function classifyAfterRedirect(
  res: Response,
  status: number,
  rootUrl: string,
  requestedHost: string,
): Promise<SiteAliveResult> {
  let finalHost: string;
  try {
    finalHost = new URL(res.url || rootUrl).hostname;
  } catch {
    finalHost = requestedHost;
  }

  if (!sameRegistrableDomain(finalHost, requestedHost)) {
    return { alive: false, reason: "redirected_offsite", rootStatus: status, rootFinalHost: finalHost };
  }

  // 401/403: site is up but gated — caller should fall through to manual_review.
  if (status === 401 || status === 403) {
    return { alive: true, reason: `http_${status}`, rootStatus: status, rootFinalHost: finalHost };
  }

  if (!res.ok) {
    return { alive: false, reason: `http_${status}`, rootStatus: status, rootFinalHost: finalHost };
  }

  const html = await res.text().catch(() => "");
  return { alive: true, reason: "ok", rootStatus: status, rootFinalHost: finalHost, rootHtml: html };
}

async function checkSiteAlive(rootUrl: string): Promise<SiteAliveResult> {
  const requestedHost = new URL(rootUrl).hostname;
  const outcome = await safeFetch(rootUrl, "GET");

  if (outcome.threw || !outcome.response) {
    return { alive: false, reason: "network_error" };
  }

  const res = outcome.response;
  const status = res.status;

  // Hard-dead statuses.
  if (status === 404 || status === 410 || status === 451) {
    return { alive: false, reason: `http_${status}`, rootStatus: status };
  }

  // Persistent server errors: treated as effectively dead for triage purposes.
  if (status >= 500 && status < 600) {
    return { alive: false, reason: `http_${status}`, rootStatus: status };
  }

  return classifyAfterRedirect(res, status, rootUrl, requestedHost);
}

/**
 * Parse anchors out of the root HTML and keep those whose visible text (or
 * an attribute like aria-label) contains a keyword. Resolve hrefs to absolute
 * URLs and drop off-domain links.
 */
function crawlKeywordAnchors(html: string, rootUrl: string): string[] {
  const rootHost = new URL(rootUrl).hostname;
  const found: string[] = [];
  const seen = new Set<string>();

  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const attrs = m[1] ?? "";
    const inner = m[2] ?? "";

    const hrefMatch = attrs.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];

    // Assemble a blob of text we consider "link text" for keyword matching.
    const visibleText = inner
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const ariaMatch = attrs.match(/aria-label\s*=\s*["']([^"']+)["']/i);
    const titleMatch = attrs.match(/title\s*=\s*["']([^"']+)["']/i);
    const textBlob = [
      visibleText,
      ariaMatch?.[1]?.toLowerCase() ?? "",
      titleMatch?.[1]?.toLowerCase() ?? "",
    ].join(" ");

    const hit = LINK_KEYWORDS.some((kw) => textBlob.includes(kw));
    if (!hit) continue;

    let abs: string;
    try {
      abs = new URL(href, rootUrl).toString();
    } catch {
      continue;
    }

    let absHost: string;
    try {
      absHost = new URL(abs).hostname;
    } catch {
      continue;
    }
    if (!sameRegistrableDomain(absHost, rootHost)) continue;

    // Strip fragment so /shop#foo and /shop collapse.
    const u = new URL(abs);
    u.hash = "";
    const clean = u.toString();

    if (seen.has(clean)) continue;
    seen.add(clean);
    found.push(clean);
  }

  return found;
}

function collectProductPageCandidates(rootUrl: string, rootHtml: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (u: string) => {
    if (seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };

  for (const path of STATIC_PRODUCT_PATHS) {
    try {
      push(new URL(path, rootUrl + "/").toString().replace(/\/$/, ""));
    } catch {
      // ignore bad URL
    }
  }

  for (const anchor of crawlKeywordAnchors(rootHtml, rootUrl)) {
    push(anchor.replace(/\/$/, ""));
  }

  return out.slice(0, MAX_PRODUCT_CANDIDATES);
}

function buildFeedUrls(productPageUrl: string): string[] {
  const trimmed = productPageUrl.replace(/\/$/, "");
  const urls: string[] = [];
  for (const suffix of FEED_SUFFIXES) {
    if (suffix.startsWith(".")) {
      urls.push(`${trimmed}${suffix}`);
    } else {
      urls.push(`${trimmed}${suffix}`);
    }
  }
  return urls;
}

function contentTypeLooksLikeFeed(contentType: string | null): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return ct.includes("xml") || ct.includes("rss") || ct.includes("atom");
}

/**
 * Accept XML that fast-xml-parser parses into an object rooted at a known
 * feed container with at least one entry/item. Handles single-vs-array
 * children (fast-xml-parser returns the lone child as an object, not a
 * 1-element array).
 */
function xmlHasFeedEntries(body: string): boolean {
  try {
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(body);
    if (!parsed || typeof parsed !== "object") return false;

    const countChild = (node: unknown): number => {
      if (node == null) return 0;
      if (Array.isArray(node)) return node.length;
      return 1;
    };

    const feed = (parsed as Record<string, unknown>).feed as
      | Record<string, unknown>
      | undefined;
    if (feed && countChild(feed.entry) >= 1) return true;

    const rss = (parsed as Record<string, unknown>).rss as Record<string, unknown> | undefined;
    if (rss) {
      const channel = rss.channel as Record<string, unknown> | undefined;
      if (channel && countChild(channel.item) >= 1) return true;
    }

    const rdf = ((parsed as Record<string, unknown>)["rdf:RDF"] ??
      (parsed as Record<string, unknown>)["rdf:rdf"]) as Record<string, unknown> | undefined;
    if (rdf && countChild(rdf.item) >= 1) return true;

    return false;
  } catch (err) {
    logger.warn("feedTriage: XML parse failed", { err });
    return false;
  }
}

interface ProbeResult {
  ok: boolean;
  reason: string;
  contentType?: string;
  status?: number;
}

async function probeFeedCandidate(url: string): Promise<ProbeResult> {
  // Try HEAD first — cheap and tells us if the candidate is reachable and
  // whether content-type looks feed-ish. Fall back to GET on 405/501 or if
  // HEAD succeeds (we still need the body to validate).
  const head = await safeFetch(url, "HEAD");
  if (!head.threw && head.response) {
    const status = head.response.status;
    if (status === 404 || status === 410) {
      return { ok: false, reason: `http_${status}`, status };
    }
    if (status !== 405 && status !== 501 && !head.response.ok) {
      return { ok: false, reason: `http_${status}`, status };
    }
    const headCt = head.response.headers.get("content-type");
    // If HEAD returned a content-type that clearly isn't a feed, skip GET.
    if (head.response.ok && headCt && !contentTypeLooksLikeFeed(headCt)) {
      // Some servers return text/html on HEAD but xml on GET. To keep HEAD
      // useful as a fast reject, only short-circuit when HEAD's content-type
      // is definitively not-xml AND the response was ok.
      return { ok: false, reason: "wrong_content_type_head", contentType: headCt, status };
    }
  }

  const get = await safeFetch(url, "GET");
  if (get.threw || !get.response) {
    return { ok: false, reason: "fetch_failed" };
  }
  const res = get.response;
  if (!res.ok) {
    return { ok: false, reason: `http_${res.status}`, status: res.status };
  }

  const contentType = res.headers.get("content-type");
  if (!contentTypeLooksLikeFeed(contentType)) {
    return { ok: false, reason: "wrong_content_type", contentType: contentType ?? undefined, status: res.status };
  }

  const body = (await res.text().catch(() => "")).trim();
  if (!body) {
    return { ok: false, reason: "empty_body", contentType: contentType ?? undefined, status: res.status };
  }

  if (!xmlHasFeedEntries(body)) {
    return { ok: false, reason: "no_entries", contentType: contentType ?? undefined, status: res.status };
  }

  return { ok: true, reason: "ok", contentType: contentType ?? undefined, status: res.status };
}

/** Crawl product pages and probe feed extensions; return recommend_add or manual_review. */
async function probeForWorkingFeed(
  source: FeedSource,
  root: string,
  alive: SiteAliveResult,
): Promise<TriageResult> {
  const productPages = alive.rootHtml
    ? collectProductPageCandidates(root, alive.rootHtml)
    : STATIC_PRODUCT_PATHS.map((p) =>
        new URL(p, root + "/").toString().replace(/\/$/, ""),
      );

  const feedUrlsProbed: string[] = [];

  for (const page of productPages) {
    const feedUrls = buildFeedUrls(page);
    for (const feedUrl of feedUrls) {
      feedUrlsProbed.push(feedUrl);
      const probe = await probeFeedCandidate(feedUrl);
      if (probe.ok) {
        return {
          site: root,
          sourceUrl: source.url,
          name: source.name,
          status: "recommend_add",
          recommendation: `Discovered working feed at ${feedUrl}. Recommend add.`,
          discoveredFeedUrl: feedUrl,
          discoveredWebsite: root,
          diagnostics: {
            siteAlive: true,
            rootStatus: alive.rootStatus,
            rootFinalHost: alive.rootFinalHost,
            productPagesProbed: productPages,
            feedUrlsProbed,
          },
        };
      }
    }
  }

  return {
    site: root,
    sourceUrl: source.url,
    name: source.name,
    status: "manual_review",
    recommendation:
      "Site is alive but no feed could be reconstructed automatically. Manual review needed.",
    diagnostics: {
      siteAlive: true,
      rootStatus: alive.rootStatus,
      rootFinalHost: alive.rootFinalHost,
      productPagesProbed: productPages,
      feedUrlsProbed,
    },
  };
}

export async function triageFailedFeed(source: FeedSource): Promise<TriageResult> {
  const root = rootOf(source);
  if (!root) {
    return {
      site: source.website || source.url,
      sourceUrl: source.url,
      name: source.name,
      status: "recommend_deletion",
      recommendation: "Source has no parseable root URL.",
      diagnostics: { siteAlive: false, productPagesProbed: [], feedUrlsProbed: [] },
    };
  }

  const alive = await checkSiteAlive(root);

  if (!alive.alive) {
    return {
      site: root,
      sourceUrl: source.url,
      name: source.name,
      status: "recommend_deletion",
      recommendation: `Site appears dead (${alive.reason}). Recommend deletion.`,
      diagnostics: {
        siteAlive: false,
        rootStatus: alive.rootStatus,
        rootFinalHost: alive.rootFinalHost,
        productPagesProbed: [],
        feedUrlsProbed: [],
      },
    };
  }

  return probeForWorkingFeed(source, root, alive);
}

export async function triageFailedFeeds(
  sources: FeedSource[],
  concurrency = 5,
): Promise<TriageResult[]> {
  const out: TriageResult[] = [];
  for (let i = 0; i < sources.length; i += concurrency) {
    const batch = sources.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(triageFailedFeed));
    out.push(...batchResults);
  }
  return out;
}

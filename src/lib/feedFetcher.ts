import { CoffeeEntry } from "./types";
import { parseFeed } from "./feedParser";
import { listEnabledMasterSources } from "./sourceStore";
import { FEED_CONCURRENCY, FEED_TIMEOUT_MS } from "./constants";
import { logger } from "./logger";
import { hasTurso, getFeedHttpMeta, type FeedHttpMeta } from "./db";

export interface FeedResult {
  url: string;
  status: "ok" | "error";
  notModified?: boolean;
  lastModified?: string;
  etag?: string;
}

// In-memory cache of HTTP conditional-fetch metadata for the no-Turso path.
const localHttpMeta = new Map<string, FeedHttpMeta>();

/** Exposed for tests so they can reset cached state between runs. */
export function __resetFeedMetaCacheForTests(): void {
  localHttpMeta.clear();
}

interface FetchTarget {
  name: string;
  url: string;
  website: string;
}

interface FetchOneResult {
  entries: CoffeeEntry[];
  ok: boolean;
  notModified?: boolean;
  lastModified?: string;
  etag?: string;
}

async function fetchOne(source: FetchTarget, meta?: FeedHttpMeta): Promise<FetchOneResult> {
  try {
    const headers: Record<string, string> = {
      "User-Agent": "CoffeeRadar/1.0",
      Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml",
    };
    if (meta?.lastModified) headers["If-Modified-Since"] = meta.lastModified;
    if (meta?.etag) headers["If-None-Match"] = meta.etag;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
    const res = await fetch(source.url, {
      signal: controller.signal,
      cache: "no-store",
      headers,
    });
    clearTimeout(timer);

    if (res.status === 304) return { entries: [], ok: true, notModified: true };
    if (!res.ok) return { entries: [], ok: false };

    const resLastModified = res.headers.get("Last-Modified") ?? undefined;
    const resEtag = res.headers.get("ETag") ?? undefined;
    const xml = await res.text();
    const entries = parseFeed(xml, source.name, source.website);
    return { entries, ok: entries.length > 0, lastModified: resLastModified, etag: resEtag };
  } catch (err) {
    logger.warn(`[fetchOne] ${source.name} (${source.url}) failed`, err);
    return { entries: [], ok: false };
  }
}

function deduplicateEntries(entries: CoffeeEntry[]): CoffeeEntry[] {
  const deduped = new Map<string, CoffeeEntry>();
  for (const entry of entries) {
    const existing = deduped.get(entry.id);
    if (!existing) {
      deduped.set(entry.id, entry);
      continue;
    }
    const existingDate = new Date(existing.date).getTime() || 0;
    const incomingDate = new Date(entry.date).getTime() || 0;
    if (incomingDate > existingDate) {
      deduped.set(entry.id, entry);
    }
  }
  return Array.from(deduped.values());
}

async function fetchWithPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
}

// Conditional-fetch metadata (ETag / Last-Modified) keyed by feed URL: from
// Turso when configured, otherwise from the in-process cache.
async function loadHttpMeta(): Promise<Record<string, FeedHttpMeta>> {
  if (!hasTurso()) return Object.fromEntries(localHttpMeta);
  try {
    return await getFeedHttpMeta();
  } catch (err) {
    // Non-fatal: this run fetches every feed unconditionally.
    logger.warn("[fetchAllFeeds] could not load HTTP metadata", err);
    return {};
  }
}

// Entries dated within the last 30 days, newest first. Undated entries drop.
function recentNewestFirst(entries: CoffeeEntry[]): CoffeeEntry[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return entries
    .filter((entry) => {
      const d = new Date(entry.date).getTime();
      return !isNaN(d) && d >= cutoff.getTime();
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function fetchAllFeeds(): Promise<{
  coffees: CoffeeEntry[];
  healthy: number;
  failed: number;
  total: number;
  feedResults: FeedResult[];
}> {
  const enabled = await listEnabledMasterSources();
  const httpMeta = await loadHttpMeta();
  const allEntries: CoffeeEntry[] = [];
  const feedResults: FeedResult[] = [];
  let healthy = 0;
  let failed = 0;

  await fetchWithPool(enabled, FEED_CONCURRENCY, async (source) => {
    const r = await fetchOne(source, httpMeta[source.url]);

    if (r.notModified) {
      healthy++;
      feedResults.push({ url: source.url, status: "ok", notModified: true });
      return;
    }

    if (r.ok) {
      healthy++;
      allEntries.push(...r.entries);
      feedResults.push({ url: source.url, status: "ok", lastModified: r.lastModified, etag: r.etag });
    } else {
      failed++;
      feedResults.push({ url: source.url, status: "error" });
    }
  });

  // Update in-memory metadata cache for the no-Turso path.
  // (For Turso, metadata is persisted via saveFeedResults by the caller.)
  if (!hasTurso()) {
    for (const r of feedResults) {
      if (r.lastModified || r.etag) {
        localHttpMeta.set(r.url, { lastModified: r.lastModified, etag: r.etag });
      }
    }
  }

  const coffees = recentNewestFirst(deduplicateEntries(allEntries));
  return { coffees, healthy, failed, total: enabled.length, feedResults };
}

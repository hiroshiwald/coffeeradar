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

export async function fetchAllFeeds(): Promise<{
  coffees: CoffeeEntry[];
  healthy: number;
  failed: number;
  total: number;
  feedResults: FeedResult[];
}> {
  const enabled = await listEnabledMasterSources();
  const allEntries: CoffeeEntry[] = [];
  const feedResults: FeedResult[] = [];
  let healthy = 0;
  let failed = 0;

  // Load conditional-fetch metadata (ETag / Last-Modified).
  let httpMeta: Record<string, FeedHttpMeta> = {};
  if (hasTurso()) {
    try {
      httpMeta = await getFeedHttpMeta();
    } catch {
      // Non-fatal: we'll just do unconditional fetches this run.
    }
  } else {
    for (const [url, meta] of localHttpMeta) {
      httpMeta[url] = meta;
    }
  }

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
      feedResults.push({
        url: source.url,
        status: "ok",
        lastModified: r.lastModified,
        etag: r.etag,
      });
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

  const deduplicated = deduplicateEntries(allEntries);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const recent = deduplicated.filter(entry => {
    const d = new Date(entry.date).getTime();
    return !isNaN(d) && d >= cutoff.getTime();
  });

  recent.sort((a, b) => {
    const da = new Date(a.date).getTime() || 0;
    const db = new Date(b.date).getTime() || 0;
    return db - da;
  });

  return { coffees: recent, healthy, failed, total: enabled.length, feedResults };
}

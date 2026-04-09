import { CoffeeEntry } from "./types";
import { parseFeed } from "./feedParser";
import { listEnabledMasterSources } from "./sourceStore";
import { FEED_CONCURRENCY, FEED_TIMEOUT_MS } from "./constants";

export interface FeedResult {
  url: string;
  status: "ok" | "error";
}

interface FetchTarget {
  name: string;
  url: string;
  website: string;
}

async function fetchOne(source: FetchTarget): Promise<{ entries: CoffeeEntry[]; ok: boolean }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
    const res = await fetch(source.url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": "CoffeeRadar/1.0", Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml" },
    });
    clearTimeout(timer);
    if (!res.ok) return { entries: [], ok: false };
    const xml = await res.text();
    const entries = parseFeed(xml, source.name, source.website);
    return { entries, ok: entries.length > 0 };
  } catch {
    return { entries: [], ok: false };
  }
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

  for (let i = 0; i < enabled.length; i += FEED_CONCURRENCY) {
    const batch = enabled.slice(i, i + FEED_CONCURRENCY);
    const results = await Promise.all(batch.map(fetchOne));
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      const src = batch[j];
      if (r.ok) {
        healthy++;
        allEntries.push(...r.entries);
        feedResults.push({ url: src.url, status: "ok" });
      } else {
        failed++;
        feedResults.push({ url: src.url, status: "error" });
      }
    }
  }

  const deduped = new Map<string, CoffeeEntry>();
  for (const entry of allEntries) {
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

  const normalized = Array.from(deduped.values());

  normalized.sort((a, b) => {
    const da = new Date(a.date).getTime() || 0;
    const db = new Date(b.date).getTime() || 0;
    return db - da;
  });

  return { coffees: normalized, healthy, failed, total: enabled.length, feedResults };
}

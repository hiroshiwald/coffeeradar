import { CoffeeEntry } from "./types";
import { parseFeed } from "./feedParser";
import { getSources } from "./sources";

const CONCURRENCY = 25;
const TIMEOUT = 5000;

interface FetchTarget {
  name: string;
  url: string;
  website: string;
}

async function fetchOne(source: FetchTarget): Promise<{ entries: CoffeeEntry[]; ok: boolean }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    const res = await fetch(source.url, {
      signal: controller.signal,
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
}> {
  const allSources = getSources();
  const enabled = allSources.filter((s) => s.enabled !== false);
  const allEntries: CoffeeEntry[] = [];
  let healthy = 0;
  let failed = 0;

  for (let i = 0; i < enabled.length; i += CONCURRENCY) {
    const batch = enabled.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(fetchOne));
    for (const r of results) {
      if (r.ok) {
        healthy++;
        allEntries.push(...r.entries);
      } else {
        failed++;
      }
    }
  }

  // Filter out entries older than 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = allEntries.filter((e) => {
    const d = new Date(e.date).getTime();
    return !d || d > thirtyDaysAgo; // Keep if date is recent or unparseable
  });

  recent.sort((a, b) => {
    const da = new Date(a.date).getTime() || 0;
    const db = new Date(b.date).getTime() || 0;
    return db - da;
  });

  return { coffees: recent, healthy, failed, total: enabled.length };
}

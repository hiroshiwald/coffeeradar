import { readFileSync } from "fs";
import { join } from "path";
import { FeedSource, CoffeeEntry } from "./types";
import { parseFeed } from "./feedParser";

const CONCURRENCY = 25;
const TIMEOUT = 5000;

function loadSources(): FeedSource[] {
  const raw = readFileSync(join(process.cwd(), "data", "sources.json"), "utf8");
  return JSON.parse(raw);
}

async function fetchOne(source: FeedSource): Promise<{ entries: CoffeeEntry[]; ok: boolean }> {
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
  const sources = loadSources();
  const allEntries: CoffeeEntry[] = [];
  let healthy = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < sources.length; i += CONCURRENCY) {
    const batch = sources.slice(i, i + CONCURRENCY);
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

  // Sort by date descending
  allEntries.sort((a, b) => {
    const da = new Date(a.date).getTime() || 0;
    const db = new Date(b.date).getTime() || 0;
    return db - da;
  });

  return { coffees: allEntries, healthy, failed, total: sources.length };
}

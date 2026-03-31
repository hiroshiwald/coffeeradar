import sourcesData from "../../data/sources.json";
import { FeedSource } from "./types";

// In-memory source list — initialized from JSON, modifiable at runtime
let sources: FeedSource[] | null = null;

function loadFromDisk(): FeedSource[] {
  return (sourcesData as unknown as FeedSource[]).map((s) => ({ ...s, enabled: s.enabled !== false }));
}

export function getSources(): FeedSource[] {
  if (!sources) sources = loadFromDisk();
  return sources;
}

export function setSources(updated: FeedSource[]): void {
  sources = updated;
}

export function addSource(source: FeedSource): FeedSource[] {
  const list = getSources();
  // Prevent duplicate URLs
  if (list.some((s) => s.url === source.url)) return list;
  list.push({ ...source, enabled: true });
  sources = list;
  return list;
}

export function removeSource(url: string): FeedSource[] {
  sources = getSources().filter((s) => s.url !== url);
  return sources;
}

export function toggleSource(url: string): FeedSource[] {
  sources = getSources().map((s) =>
    s.url === url ? { ...s, enabled: !s.enabled } : s
  );
  return sources;
}

// In-memory health for local dev (populated by coffees route refresh)
let inMemoryHealth: Record<string, string> = {};
export function setInMemoryHealth(h: Record<string, string>) { inMemoryHealth = h; }
export function getInMemoryHealth(): Record<string, string> { return inMemoryHealth; }

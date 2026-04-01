import sourcesData from "../../data/sources.json";
import { FeedSource } from "./types";

let sources: FeedSource[] | null = null;

function loadFromDisk(): FeedSource[] {
  return (sourcesData as unknown as FeedSource[]).map((s) => ({ ...s, enabled: s.enabled !== false }));
}

export function getSources(): FeedSource[] {
  if (!sources) sources = loadFromDisk();
  return sources;
}

export function addSource(source: FeedSource): FeedSource[] {
  const list = getSources();
  if (list.some((s) => s.url === source.url)) return list;
  list.push({ ...source, enabled: source.enabled !== false });
  sources = list;
  return list;
}

export function updateSource(url: string, updates: Partial<FeedSource>): FeedSource[] {
  sources = getSources().map((s) => (s.url === url ? { ...s, ...updates } : s));
  return sources;
}

export function removeSource(url: string): FeedSource[] {
  sources = getSources().filter((s) => s.url !== url);
  return sources;
}

export function toggleSource(url: string): FeedSource[] {
  sources = getSources().map((s) => (s.url === url ? { ...s, enabled: !s.enabled } : s));
  return sources;
}

let inMemoryHealth: Record<string, string> = {};
export function setInMemoryHealth(h: Record<string, string>) { inMemoryHealth = h; }
export function getInMemoryHealth(): Record<string, string> { return inMemoryHealth; }

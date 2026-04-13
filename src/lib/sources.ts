import sourcesData from "../../data/sources.json";
import { FeedSource } from "./types";

export interface InMemoryStore {
  getSources(): FeedSource[];
  addSource(source: FeedSource): FeedSource[];
  updateSource(url: string, updates: Partial<FeedSource>): FeedSource[];
  removeSource(url: string): FeedSource[];
  toggleSource(url: string): FeedSource[];
  setHealth(h: Record<string, string>): void;
  getHealth(): Record<string, string>;
}

function loadFromDisk(): FeedSource[] {
  return (sourcesData as unknown as FeedSource[]).map((s) => ({ ...s, enabled: s.enabled !== false }));
}

export function createInMemoryStore(): InMemoryStore {
  let sources: FeedSource[] | null = null;
  let health: Record<string, string> = {};

  function getSources(): FeedSource[] {
    if (!sources) sources = loadFromDisk();
    return sources;
  }

  return {
    getSources,
    addSource(source: FeedSource): FeedSource[] {
      const list = getSources();
      if (list.some((s) => s.url === source.url)) return list;
      list.push({ ...source, enabled: source.enabled !== false });
      sources = list;
      return list;
    },
    updateSource(url: string, updates: Partial<FeedSource>): FeedSource[] {
      sources = getSources().map((s) => (s.url === url ? { ...s, ...updates } : s));
      return sources;
    },
    removeSource(url: string): FeedSource[] {
      sources = getSources().filter((s) => s.url !== url);
      return sources;
    },
    toggleSource(url: string): FeedSource[] {
      sources = getSources().map((s) => (s.url === url ? { ...s, enabled: !s.enabled } : s));
      return sources;
    },
    setHealth(h: Record<string, string>) { health = h; },
    getHealth() { return health; },
  };
}

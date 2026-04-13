import { FeedSource } from "./types";
import {
  getFeedResults,
  getFeedSources,
  hasTurso,
  initDb,
  removeFeedSource,
  toggleFeedSource,
  upsertFeedSource,
} from "./db";
import { createInMemoryStore, InMemoryStore } from "./sources";

// Memoize initDb so we only run the schema/seed bootstrap once per process
// instead of on every read/write.
let initPromise: Promise<void> | null = null;
function ensureInit(): Promise<void> {
  if (!initPromise) initPromise = initDb();
  return initPromise;
}

// Private singleton — state is owned here, not exported from sources.ts.
let memStore: InMemoryStore | null = null;
function getMemStore(): InMemoryStore {
  if (!memStore) memStore = createInMemoryStore();
  return memStore;
}

// Exposed for tests so they can reset cached state between runs.
export function __resetSourceStoreForTests(): void {
  initPromise = null;
  memStore = null;
}

export async function listMasterSources(): Promise<FeedSource[]> {
  if (hasTurso()) {
    await ensureInit();
    return getFeedSources(false);
  }
  return getMemStore().getSources();
}

export async function listEnabledMasterSources(): Promise<FeedSource[]> {
  if (hasTurso()) {
    await ensureInit();
    return getFeedSources(true);
  }
  return getMemStore().getSources().filter((s) => s.enabled !== false);
}

export async function addOrUpdateMasterSource(source: FeedSource): Promise<FeedSource[]> {
  if (hasTurso()) {
    await ensureInit();
    await upsertFeedSource(source);
    return getFeedSources(false);
  }

  const store = getMemStore();
  const existing = store.getSources().find((s) => s.url === source.url);
  if (existing) {
    return store.updateSource(source.url, {
      name: source.name,
      website: source.website,
      enabled: source.enabled,
    });
  }
  return store.addSource(source);
}

export async function removeMasterSource(url: string): Promise<FeedSource[]> {
  if (hasTurso()) {
    await ensureInit();
    await removeFeedSource(url);
    return getFeedSources(false);
  }
  return getMemStore().removeSource(url);
}

export async function toggleMasterSource(url: string): Promise<FeedSource[]> {
  if (hasTurso()) {
    await ensureInit();
    await toggleFeedSource(url);
    return getFeedSources(false);
  }
  return getMemStore().toggleSource(url);
}

export async function getSourceHealth(): Promise<Record<string, string>> {
  if (hasTurso()) {
    await ensureInit();
    return getFeedResults();
  }
  return getMemStore().getHealth();
}

export async function setSourceHealth(h: Record<string, string>): Promise<void> {
  if (hasTurso()) return;
  getMemStore().setHealth(h);
}

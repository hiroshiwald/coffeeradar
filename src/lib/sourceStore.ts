import { FeedSource } from "./types";
import {
  getFeedSources,
  hasTurso,
  initDb,
  removeFeedSource,
  toggleFeedSource,
  upsertFeedSource,
} from "./db";
import {
  addSource,
  getSources,
  removeSource,
  toggleSource,
  updateSource,
} from "./sources";

// Memoize initDb so we only run the schema/seed bootstrap once per process
// instead of on every read/write.
let initPromise: Promise<void> | null = null;
function ensureInit(): Promise<void> {
  if (!initPromise) initPromise = initDb();
  return initPromise;
}

// Exposed for tests so they can reset the cached init between runs.
export function __resetSourceStoreInitForTests(): void {
  initPromise = null;
}

export async function listMasterSources(): Promise<FeedSource[]> {
  if (hasTurso()) {
    await ensureInit();
    return getFeedSources(false);
  }
  return getSources();
}

export async function listEnabledMasterSources(): Promise<FeedSource[]> {
  if (hasTurso()) {
    await ensureInit();
    return getFeedSources(true);
  }
  return getSources().filter((s) => s.enabled !== false);
}

export async function addOrUpdateMasterSource(source: FeedSource): Promise<FeedSource[]> {
  if (hasTurso()) {
    await ensureInit();
    await upsertFeedSource(source);
    return getFeedSources(false);
  }

  const existing = getSources().find((s) => s.url === source.url);
  if (existing) {
    return updateSource(source.url, {
      name: source.name,
      website: source.website,
      enabled: source.enabled,
    });
  }
  return addSource(source);
}

export async function removeMasterSource(url: string): Promise<FeedSource[]> {
  if (hasTurso()) {
    await ensureInit();
    await removeFeedSource(url);
    return getFeedSources(false);
  }
  return removeSource(url);
}

export async function toggleMasterSource(url: string): Promise<FeedSource[]> {
  if (hasTurso()) {
    await ensureInit();
    await toggleFeedSource(url);
    return getFeedSources(false);
  }
  return toggleSource(url);
}

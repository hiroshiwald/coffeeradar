import { FeedSource, FilterMode } from "./types";

export function getHealthStatus(health: Record<string, string>, url: string): string {
  return health[url] ?? "unknown";
}

export function computeHealthCounts(sources: FeedSource[], health: Record<string, string>) {
  const healthy = sources.filter((s) => getHealthStatus(health, s.url) === "ok").length;
  const failed = sources.filter((s) => getHealthStatus(health, s.url) === "error").length;
  return { healthy, failed, unknown: sources.length - healthy - failed };
}

export function filterSources(
  sources: FeedSource[],
  health: Record<string, string>,
  search: string,
  filterMode: FilterMode,
): FeedSource[] {
  let filtered = search
    ? sources.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.url.toLowerCase().includes(search.toLowerCase()),
      )
    : sources;
  if (filterMode === "healthy") filtered = filtered.filter((s) => getHealthStatus(health, s.url) === "ok");
  if (filterMode === "failed") filtered = filtered.filter((s) => getHealthStatus(health, s.url) === "error");
  if (filterMode === "unknown") filtered = filtered.filter((s) => getHealthStatus(health, s.url) === "unknown");
  return filtered;
}

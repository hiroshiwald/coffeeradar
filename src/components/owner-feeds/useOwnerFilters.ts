import { useState } from "react";
import { FeedSource, FilterMode } from "@/lib/types";
import { computeHealthCounts, filterSources } from "@/lib/feedFilters";

export function useOwnerFilters(sources: FeedSource[], health: Record<string, string>) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const filtered = filterSources(sources, health, search, filterMode);
  const { healthy, failed, unknown } = computeHealthCounts(sources, health);
  const enabledCount = sources.filter((s) => s.enabled !== false).length;

  return {
    search, setSearch,
    filterMode, setFilterMode,
    filtered,
    healthyCount: healthy, failedCount: failed, unknownCount: unknown,
    enabledCount, disabledCount: sources.length - enabledCount,
    hasHealth: Object.keys(health).length > 0,
  };
}

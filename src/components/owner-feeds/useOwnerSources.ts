import { useCallback, useEffect, useMemo, useState } from "react";
import { FeedSource, FeedSuggestion } from "@/lib/types";

export function useOwnerSources() {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [health, setHealth] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<FeedSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/sources");
    const data = await res.json();
    setSources(data.sources ?? []);
    if (data.health) setHealth(data.health);
    if (data.suggestions) setSuggestions(data.suggestions);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const suggestionsByUrl = useMemo(() => {
    const map: Record<string, FeedSuggestion> = {};
    for (const s of suggestions) map[s.sourceUrl] = s;
    return map;
  }, [suggestions]);

  return {
    sources, health, suggestions, loading, suggestionsByUrl,
    setSources, setSuggestions, fetchSources,
  };
}

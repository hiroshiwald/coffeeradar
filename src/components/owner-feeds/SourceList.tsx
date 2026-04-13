import { FeedSource, FeedSuggestion } from "@/lib/types";
import { getHealthStatus } from "@/lib/feedFilters";
import { FeedSourceItem } from "./FeedSourceItem";
import { FeedSuggestionCard } from "./FeedSuggestionCard";

interface SourceListProps {
  loading: boolean;
  sources: FeedSource[];
  health: Record<string, string>;
  suggestionsByUrl: Record<string, FeedSuggestion>;
  busy: boolean;
  doAction: (action: string, payload: Record<string, string>) => Promise<void>;
  dismissSuggestion: (oldUrl: string) => void;
  fetchSources: () => Promise<void>;
}

export function SourceList({
  loading, sources, health, suggestionsByUrl, busy, doAction, dismissSuggestion, fetchSources,
}: SourceListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800/50">
      {sources.map((source) => {
        const suggestion = suggestionsByUrl[source.url];
        return (
          <FeedSourceItem
            key={source.url}
            source={source}
            status={getHealthStatus(health, source.url)}
            busy={busy}
            onToggle={() => doAction("toggle", { url: source.url })}
            onRemove={() => doAction("remove", { url: source.url })}
          >
            {suggestion && (
              <FeedSuggestionCard
                suggestion={suggestion}
                source={source}
                busy={busy}
                doAction={doAction}
                onDismiss={() => dismissSuggestion(source.url)}
                fetchSources={fetchSources}
              />
            )}
          </FeedSourceItem>
        );
      })}
    </div>
  );
}

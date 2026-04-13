import { FeedSource, FeedSuggestion } from "@/lib/types";
import { RecommendAddCard, RecommendDeletionCard, ManualReviewCard, LegacySuggestionCard } from "./SuggestionCards";

interface FeedSuggestionCardProps {
  suggestion: FeedSuggestion;
  source: FeedSource;
  busy: boolean;
  doAction: (action: string, payload: Record<string, string>) => Promise<void>;
  onDismiss: () => void;
  fetchSources: () => Promise<void>;
}

export function FeedSuggestionCard({
  suggestion, source, busy, doAction, onDismiss, fetchSources,
}: FeedSuggestionCardProps) {
  async function handleApprove() {
    if (!suggestion.suggestedFeedUrl) return;
    await doAction("approve_suggestion", {
      oldUrl: source.url,
      newUrl: suggestion.suggestedFeedUrl,
      newWebsite: suggestion.suggestedWebsite ?? source.website,
      name: source.name,
    });
    await fetchSources();
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `The site at ${source.website} appears to be dead. Delete this source permanently?`,
    );
    if (!confirmed) return;
    await doAction("delete_dead_source", { url: source.url });
    onDismiss();
  }

  const props = { suggestion, busy, onDismiss, onApprove: handleApprove, onDelete: handleDelete };

  if (suggestion.reason === "recommend_add" && suggestion.preflightOk && suggestion.suggestedFeedUrl) {
    return <RecommendAddCard {...props} />;
  }
  if (suggestion.reason === "site_dead") return <RecommendDeletionCard {...props} />;
  if (suggestion.reason === "manual_review") return <ManualReviewCard {...props} />;
  return <LegacySuggestionCard {...props} />;
}

import { FeedSuggestion } from "@/lib/types";

interface SuggestionCardProps {
  suggestion: FeedSuggestion;
  busy: boolean;
  onApprove?: () => void;
  onDismiss: () => void;
  onDelete?: () => void;
}

export function RecommendAddCard({ suggestion, busy, onApprove, onDismiss }: SuggestionCardProps) {
  return (
    <div className="mx-4 mb-3 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10">
      <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 mb-1">Recommend add: discovered working feed</p>
      <p className="text-xs text-gray-700 dark:text-gray-200 break-all">→ {suggestion.suggestedFeedUrl}</p>
      {suggestion.suggestedWebsite && <p className="text-xs text-gray-500 break-all">website: {suggestion.suggestedWebsite}</p>}
      <div className="flex gap-2 mt-2">
        <button onClick={onApprove} disabled={busy} className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs disabled:opacity-50">Approve &amp; replace</button>
        <button onClick={onDismiss} disabled={busy} className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-xs">Dismiss</button>
      </div>
    </div>
  );
}

export function RecommendDeletionCard({ busy, onDismiss, onDelete }: SuggestionCardProps) {
  return (
    <div className="mx-4 mb-3 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-900/10">
      <p className="text-xs font-medium text-red-800 dark:text-red-300 mb-1">Recommend deletion: site appears dead</p>
      <p className="text-xs text-gray-600 dark:text-gray-400">The root URL is unreachable, returns an error, or redirects off-domain.</p>
      <div className="flex gap-2 mt-2">
        <button onClick={onDelete} disabled={busy} className="px-3 py-1 rounded-md bg-red-600 text-white text-xs disabled:opacity-50">Delete source</button>
        <button onClick={onDismiss} disabled={busy} className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-xs">Dismiss</button>
      </div>
    </div>
  );
}

export function ManualReviewCard({ busy, onDismiss }: SuggestionCardProps) {
  return (
    <div className="mx-4 mb-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Manual review needed</p>
      <p className="text-xs text-gray-600 dark:text-gray-400">Site is alive but no feed could be reconstructed automatically.</p>
      <div className="flex gap-2 mt-2">
        <button onClick={onDismiss} disabled={busy} className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-xs">Dismiss</button>
      </div>
    </div>
  );
}

export function LegacySuggestionCard({ suggestion, busy, onApprove, onDismiss }: SuggestionCardProps) {
  if (suggestion.suggestedFeedUrl && suggestion.preflightOk) {
    return (
      <div className="mx-4 mb-3 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10">
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Suggested replacement feed (preflight passed)</p>
        <p className="text-xs text-gray-700 dark:text-gray-200 break-all">→ {suggestion.suggestedFeedUrl}</p>
        {suggestion.suggestedWebsite && <p className="text-xs text-gray-500 break-all">website: {suggestion.suggestedWebsite}</p>}
        <div className="flex gap-2 mt-2">
          <button onClick={onApprove} disabled={busy} className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs disabled:opacity-50">Approve &amp; replace</button>
          <button onClick={onDismiss} disabled={busy} className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-xs">Dismiss</button>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-4 mb-3 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-600 dark:text-gray-400">No valid replacement found{suggestion.reason ? ` (${suggestion.reason})` : ""}.</p>
        <button onClick={onDismiss} disabled={busy} className="px-2 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-xs">Dismiss</button>
      </div>
    </div>
  );
}

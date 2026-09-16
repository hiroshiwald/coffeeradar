/**
 * The header treatment: gray question plus the bordered Ko-fi button.
 *
 * Exported so the owner admin preview shows the real thing instead of a copy
 * that drifts from it. A null href renders the same markup with no link target,
 * which is what the preview wants — visible but not clickable.
 */
export function TipLinkTreatment({ href }: { href: string | null }) {
  return (
    <div className="flex items-center gap-2.5 mr-1">
      <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
        Found something good?
      </span>
      <a
        href={href ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-[7px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs whitespace-nowrap hover:bg-gray-50 dark:hover:bg-gray-800 transition"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5e5b] flex-none" />
        Leave a tip on Ko-Fi ↗
      </a>
    </div>
  );
}

/**
 * Renders nothing unless the owner left the tip link on with a usable URL.
 *
 * `tipUrl` arrives already through resolveTipUrl() on the server, so null here
 * means either the toggle is off or getTipUrl() rejected the URL.
 */
export default function TipLink({ tipUrl }: { tipUrl: string | null }) {
  if (!tipUrl) return null;
  return <TipLinkTreatment href={tipUrl} />;
}

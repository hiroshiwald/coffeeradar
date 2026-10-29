import { ReactNode } from "react";
import { FeedSource } from "@/lib/types";

interface FeedSourceItemProps {
  source: FeedSource;
  status: string;
  busy: boolean;
  onToggle: () => void;
  onRemove: () => void;
  children?: ReactNode;
}

export function FeedSourceItem({ source, status, busy, onToggle, onRemove, children }: FeedSourceItemProps) {
  return (
    <div className={`${source.enabled === false ? "opacity-50" : ""}`}>
      {/* Below sm the name and URL take a second line, so they get the full width. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status === "ok" ? "bg-emerald-500" : status === "error" ? "bg-red-400" : "bg-gray-300 dark:bg-gray-600"}`} />
        <button onClick={onToggle} disabled={busy} className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 ${source.enabled !== false ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}>
          <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${source.enabled !== false ? "translate-x-3.5" : "translate-x-0.5"}`} />
        </button>
        <div className="min-w-0 basis-full order-last sm:flex-1 sm:order-none">
          <p className="text-sm font-medium truncate">{source.name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{source.url}</p>
        </div>
        <a href={source.website} target="_blank" rel="noopener noreferrer" className="ml-auto py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition flex-shrink-0">Visit</a>
        <button onClick={onRemove} disabled={busy} className="py-2 text-xs text-red-400 hover:text-red-600 transition flex-shrink-0">Remove</button>
      </div>
      {children}
    </div>
  );
}

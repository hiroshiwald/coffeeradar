import { FilterMode } from "@/lib/types";

interface FeedFilterBarProps {
  filterMode: FilterMode;
  onSetFilterMode: (mode: FilterMode) => void;
  sourceCount: number;
  healthyCount: number;
  failedCount: number;
  unknownCount: number;
  rescanning: boolean;
  busy: boolean;
  onRescanFailed: () => void;
}

const btnBase = "px-3 py-1.5 rounded-lg text-xs transition";

export function FeedFilterBar({
  filterMode, onSetFilterMode, sourceCount, healthyCount, failedCount, unknownCount, rescanning, busy, onRescanFailed,
}: FeedFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <button onClick={() => onSetFilterMode("all")} className={`${btnBase} ${filterMode === "all" ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}>
        All ({sourceCount})
      </button>
      <button onClick={() => onSetFilterMode("healthy")} className={`${btnBase} ${filterMode === "healthy" ? "bg-emerald-600 text-white" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"}`}>
        Healthy ({healthyCount})
      </button>
      <button onClick={() => onSetFilterMode("failed")} className={`${btnBase} ${filterMode === "failed" ? "bg-red-600 text-white" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"}`}>
        Failed ({failedCount})
      </button>
      <button onClick={() => onSetFilterMode("unknown")} className={`${btnBase} ${filterMode === "unknown" ? "bg-gray-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>
        Unknown ({unknownCount})
      </button>
      {filterMode === "failed" && failedCount > 0 && (
        <button onClick={onRescanFailed} disabled={rescanning || busy} className="ml-auto px-3 py-1.5 rounded-lg text-xs bg-amber-600 text-white disabled:opacity-50">
          {rescanning ? "Rescanning..." : "Rescan failed feeds"}
        </button>
      )}
    </div>
  );
}

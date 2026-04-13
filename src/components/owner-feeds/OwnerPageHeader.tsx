interface OwnerPageHeaderProps {
  sourceCount: number;
  enabledCount: number;
  disabledCount: number;
  cronRunning: boolean;
  busy: boolean;
  onRunCron: () => void;
  onExportCsv: () => void;
}

export function OwnerPageHeader({
  sourceCount, enabledCount, disabledCount, cronRunning, busy, onRunCron, onExportCsv,
}: OwnerPageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-light tracking-tight">Owner Feed Admin</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          MASTER list: {sourceCount} sources ({enabledCount} enabled, {disabledCount} disabled)
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onRunCron}
          disabled={cronRunning || busy}
          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
        >
          {cronRunning ? "Running..." : "Run Cron"}
        </button>
        <button
          onClick={onExportCsv}
          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Download CSV
        </button>
        <a
          href="/"
          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition inline-flex items-center"
        >
          ← Back
        </a>
      </div>
    </div>
  );
}

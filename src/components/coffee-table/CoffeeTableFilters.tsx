"use client";

interface Props {
  search: string;
  filterType: string;
  filterProcess: string;
  showMerch: boolean;
  merchCount: number;
  loading: boolean;
  onSearchChange: (v: string) => void;
  onTypeChange: (v: string) => void;
  onProcessChange: (v: string) => void;
  onToggleMerch: () => void;
  onRefresh: () => void;
}

export default function CoffeeTableFilters({
  search,
  filterType,
  filterProcess,
  showMerch,
  merchCount,
  loading,
  onSearchChange,
  onTypeChange,
  onProcessChange,
  onToggleMerch,
  onRefresh,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search coffees, roasters, notes..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 transition"
        />
      </div>

      <select
        value={filterType}
        onChange={(e) => onTypeChange(e.target.value)}
        className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
      >
        <option value="">All Types</option>
        <option value="Single Origin">Single Origin</option>
        <option value="Blend">Blend</option>
        <option value="Unknown">Unknown</option>
      </select>

      <select
        value={filterProcess}
        onChange={(e) => onProcessChange(e.target.value)}
        className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
      >
        <option value="">All Processes</option>
        <option value="Washed">Washed</option>
        <option value="Natural">Natural</option>
        <option value="Honey">Honey</option>
        <option value="Anaerobic">Anaerobic</option>
        <option value="Anaerobic Natural">Anaerobic Natural</option>
        <option value="Co-Ferment">Co-Ferment</option>
        <option value="Yellow Honey">Yellow Honey</option>
        <option value="Red Honey">Red Honey</option>
        <option value="Black Honey">Black Honey</option>
      </select>

      <button
        onClick={onToggleMerch}
        className={`px-3 py-2.5 rounded-lg border text-sm transition whitespace-nowrap ${
          showMerch
            ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400"
        }`}
      >
        {showMerch ? `Merch (${merchCount})` : "Show Merch"}
      </button>

      <button
        onClick={onRefresh}
        disabled={loading}
        className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50 whitespace-nowrap"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </span>
        ) : (
          "Refresh"
        )}
      </button>
    </div>
  );
}

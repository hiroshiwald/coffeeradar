"use client";

import { useCallback } from "react";
import { CoffeeEntry } from "@/lib/types";
import { getNoteColor } from "@/lib/noteColors";
import { timeAgo } from "@/lib/formatters";
import { useCoffeeData } from "@/hooks/useCoffeeData";
import ThemeToggle from "./ThemeToggle";
import { useCoffeeFilters } from "./coffee-table/useCoffeeFilters";
import CoffeeTableFilters from "./coffee-table/CoffeeTableFilters";
import CoffeeTableHeader from "./coffee-table/CoffeeTableHeader";
import CoffeeTableRow from "./coffee-table/CoffeeTableRow";

export default function CoffeeTable() {
  const { data, loading, refresh, isBackgroundRefreshing } = useCoffeeData();
  const {
    filters,
    sortKey,
    sortDir,
    filtered,
    popularNotes,
    setSearch,
    setFilterType,
    setFilterProcess,
    setFilterNote,
    setShowMerch,
    toggleSort,
  } = useCoffeeFilters(data?.coffees);

  const onSelectNote = useCallback((note: string) => setFilterNote(note), [setFilterNote]);

  const meta = data?.meta;
  const merchCount = data ? data.coffees.filter((c) => c.isMerch).length : 0;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight">CoffeeRadar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">New releases from specialty roasters</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/roasters"
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Roasters
          </a>
          <ThemeToggle />
        </div>
      </div>

      <CoffeeTableFilters
        search={filters.search}
        filterType={filters.filterType}
        filterProcess={filters.filterProcess}
        showMerch={filters.showMerch}
        merchCount={merchCount}
        loading={loading}
        isBackgroundRefreshing={isBackgroundRefreshing}
        onSearchChange={setSearch}
        onTypeChange={setFilterType}
        onProcessChange={setFilterProcess}
        onToggleMerch={() => setShowMerch(!filters.showMerch)}
        onRefresh={() => refresh()}
      />

      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
        {meta && (
          <>
            <span>Updated {timeAgo(meta.lastRefresh)}</span>
            {meta.isFallback && (
              <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                Showing demo data — feeds unavailable
              </span>
            )}
          </>
        )}
        <span className="ml-auto">{filtered.length} coffees</span>
      </div>

      {filters.filterNote && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">Note:</span>
          <button
            onClick={() => setFilterNote("")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
          >
            {filters.filterNote}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <CoffeeTableHeader sortKey={sortKey} sortDir={sortDir} onToggleSort={toggleSort} />
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {loading && !data ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  No coffees match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((c: CoffeeEntry) => (
                <CoffeeTableRow key={c.id} coffee={c} onSelectNote={onSelectNote} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {popularNotes.length > 0 && !filters.filterNote && (
        <div className="mt-6">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Popular notes</p>
          <div className="flex flex-wrap gap-1.5">
            {popularNotes.slice(0, 20).map((note) => (
              <button
                key={note}
                onClick={() => setFilterNote(note)}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors hover:opacity-80 ${getNoteColor(note)}`}
              >
                {note}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-300 dark:text-gray-700 mt-10">CoffeeRadar v1</p>
    </div>
  );
}

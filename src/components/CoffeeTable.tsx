"use client";

import { useMemo, useState } from "react";
import { CoffeeEntry } from "@/lib/types";
import { getNoteColor } from "@/lib/noteColors";
import { timeAgo, formatDate } from "@/lib/formatters";
import { filterCoffees, sortCoffees, countNotes, SortKey, SortDir } from "@/lib/coffeeFilters";
import { useCoffeeData } from "@/hooks/useCoffeeData";
import ThemeToggle from "./ThemeToggle";

export default function CoffeeTable() {
  const { data, loading, refresh } = useCoffeeData();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterType, setFilterType] = useState("");
  const [filterProcess, setFilterProcess] = useState("");
  const [filterNote, setFilterNote] = useState("");
  const [showMerch, setShowMerch] = useState(false);

  const allNotes = useMemo(() => {
    if (!data) return [];
    const counts = countNotes(data.coffees);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const list = filterCoffees(data.coffees, { search, filterType, filterProcess, filterNote, showMerch });
    return sortCoffees(list, sortKey, sortDir);
  }, [data, search, filterType, filterProcess, filterNote, sortKey, sortDir, showMerch]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-gray-300 dark:text-gray-600 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const meta = data?.meta;
  const merchCount = data ? data.coffees.filter((c) => c.isMerch).length : 0;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight">CoffeeRadar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">New releases from specialty roasters</p>
        </div>
        <div className="flex items-center gap-2">

          <ThemeToggle />
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search coffees, roasters, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 transition"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
        >
          <option value="">All Types</option>
          <option value="Single Origin">Single Origin</option>
          <option value="Blend">Blend</option>
          <option value="Unknown">Unknown</option>
        </select>

        <select
          value={filterProcess}
          onChange={(e) => setFilterProcess(e.target.value)}
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

        {/* Merch toggle */}
        <button
          onClick={() => setShowMerch(!showMerch)}
          className={`px-3 py-2.5 rounded-lg border text-sm transition whitespace-nowrap ${
            showMerch
              ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400"
          }`}
        >
          {showMerch ? `Merch (${merchCount})` : "Show Merch"}
        </button>

        <button
          onClick={() => refresh()}
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
          ) : "Refresh"}
        </button>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
        {meta && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {meta.healthy} healthy
            </span>
            {meta.failed > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                {meta.failed} failed
              </span>
            )}
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

      {/* Active note filter */}
      {filterNote && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">Note:</span>
          <button
            onClick={() => setFilterNote("")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
          >
            {filterNote}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 w-12"></th>
              {(
                [
                  ["date", "Date"],
                  ["roaster", "Roaster"],
                  ["coffee", "Coffee"],
                  ["type", "Type"],
                  ["process", "Process"],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer select-none hover:text-gray-900 dark:hover:text-white transition whitespace-nowrap"
                >
                  {label}
                  <SortIcon col={key} />
                </th>
              ))}
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Notes</th>
              <th
                onClick={() => toggleSort("price")}
                className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer select-none hover:text-gray-900 dark:hover:text-white transition whitespace-nowrap"
              >
                Price
                <SortIcon col="price" />
              </th>
            </tr>
          </thead>
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
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                  <td className="px-4 py-2">
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-gray-800"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                        </svg>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(c.date)}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{c.roaster}</td>
                  <td className="px-4 py-3">
                    <a
                      href={c.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline underline-offset-2"
                    >
                      {c.coffee}
                    </a>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.isMerch ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                        Merch
                      </span>
                    ) : c.type !== "Unknown" ? (
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                          c.type === "Single Origin"
                            ? "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300"
                            : "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300"
                        }`}
                      >
                        {c.type}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{c.process}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tastingNotes.map((note) => (
                        <button
                          key={note}
                          onClick={() => setFilterNote(note)}
                          className={`px-2 py-0.5 rounded-full text-xs transition-colors hover:opacity-80 ${getNoteColor(note)}`}
                        >
                          {note}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap font-mono text-xs tabular-nums">{c.price}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Popular notes */}
      {allNotes.length > 0 && !filterNote && (
        <div className="mt-6">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Popular notes</p>
          <div className="flex flex-wrap gap-1.5">
            {allNotes.slice(0, 20).map((note) => (
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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiResponse, CoffeeEntry } from "@/lib/types";
import ThemeToggle from "./ThemeToggle";

type SortKey = "date" | "roaster" | "coffee" | "type" | "process" | "price";
type SortDir = "asc" | "desc";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export default function CoffeeTable() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterType, setFilterType] = useState("");
  const [filterProcess, setFilterProcess] = useState("");
  const [filterNote, setFilterNote] = useState("");

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const url = refresh ? "/api/coffees?refresh=true" : "/api/coffees";
      const res = await fetch(url);
      const json: ApiResponse = await res.json();
      setData(json);
    } catch {
      // keep existing data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Collect unique values for filters
  const allNotes = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const c of data.coffees) {
      for (const n of c.tastingNotes) {
        counts.set(n, (counts.get(n) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [data]);

  // Filter & sort
  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.coffees;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.roaster.toLowerCase().includes(q) ||
          c.coffee.toLowerCase().includes(q) ||
          c.type.toLowerCase().includes(q) ||
          c.process.toLowerCase().includes(q) ||
          c.tastingNotes.some((n) => n.toLowerCase().includes(q))
      );
    }
    if (filterType) list = list.filter((c) => c.type === filterType);
    if (filterProcess) list = list.filter((c) => c.process === filterProcess);
    if (filterNote) list = list.filter((c) => c.tastingNotes.includes(filterNote));

    const sorted = [...list].sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (sortKey) {
        case "date":
          va = new Date(a.date).getTime() || 0;
          vb = new Date(b.date).getTime() || 0;
          break;
        case "price":
          va = parseFloat(a.price.replace(/[^0-9.]/g, "")) || 0;
          vb = parseFloat(b.price.replace(/[^0-9.]/g, "")) || 0;
          break;
        default:
          va = a[sortKey].toLowerCase();
          vb = b[sortKey].toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, search, filterType, filterProcess, filterNote, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-gray-300 dark:text-gray-600 ml-1">&#8597;</span>;
    return <span className="ml-1">{sortDir === "asc" ? "&#8593;" : "&#8595;"}</span>;
  }

  const meta = data?.meta;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight">CoffeeRadar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">New releases from specialty roasters</p>
        </div>
        <ThemeToggle />
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
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

        {/* Filters */}
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
          <option value="Co-Ferment">Co-Ferment</option>
        </select>

        {/* Refresh */}
        <button
          onClick={() => fetchData(true)}
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

      {/* Note tag filter chips */}
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
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  No coffees match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((c: CoffeeEntry) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
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
                    {c.type !== "Unknown" && (
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                          c.type === "Single Origin"
                            ? "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300"
                            : "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300"
                        }`}
                      >
                        {c.type}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{c.process}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tastingNotes.map((note) => (
                        <button
                          key={note}
                          onClick={() => setFilterNote(note)}
                          className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          {note}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{c.price}</td>
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
                className="px-2.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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

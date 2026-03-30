"use client";

import { useCallback, useEffect, useState } from "react";
import { FeedSource } from "@/lib/types";

export default function AdminPage() {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/sources");
    const data = await res.json();
    setSources(data.sources);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  async function doAction(action: string, payload: Record<string, string>) {
    setBusy(true);
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json();
    if (data.sources) setSources(data.sources);
    setBusy(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newUrl) return;
    await doAction("add", { name: newName, url: newUrl, website: newWebsite || newUrl });
    setNewName("");
    setNewUrl("");
    setNewWebsite("");
  }

  function handleExport() {
    const json = JSON.stringify(sources, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sources.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = search
    ? sources.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.url.toLowerCase().includes(search.toLowerCase())
      )
    : sources;

  const enabledCount = sources.filter((s) => s.enabled !== false).length;
  const disabledCount = sources.length - enabledCount;

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight">Feed Admin</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {sources.length} sources ({enabledCount} enabled, {disabledCount} disabled)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Export JSON
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition inline-flex items-center"
          >
            &larr; Back
          </a>
        </div>
      </div>

      {/* Add new source */}
      <form onSubmit={handleAdd} className="mb-6 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <p className="text-sm font-medium mb-3">Add New Source</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Roaster name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
            required
          />
          <input
            type="url"
            placeholder="Feed URL (.atom or ?format=rss)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="flex-[2] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
            required
          />
          <input
            type="url"
            placeholder="Website (optional)"
            value={newWebsite}
            onChange={(e) => setNewWebsite(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
          />
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </form>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search sources..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
        />
      </div>

      {/* Sources list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800/50">
          {filtered.map((source) => (
            <div
              key={source.url}
              className={`flex items-center gap-4 px-4 py-3 ${
                source.enabled === false ? "opacity-50" : ""
              }`}
            >
              <button
                onClick={() => doAction("toggle", { url: source.url })}
                disabled={busy}
                className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 ${
                  source.enabled !== false
                    ? "bg-emerald-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    source.enabled !== false ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{source.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{source.url}</p>
              </div>

              <a
                href={source.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition flex-shrink-0"
              >
                Visit
              </a>

              <button
                onClick={() => doAction("remove", { url: source.url })}
                disabled={busy}
                className="text-xs text-red-400 hover:text-red-600 transition flex-shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">No sources match your search.</p>
          )}
        </div>
      )}

      <p className="text-center text-xs text-gray-300 dark:text-gray-700 mt-8">
        Changes persist while the server is running. Use Export to save permanently.
      </p>
    </div>
  );
}

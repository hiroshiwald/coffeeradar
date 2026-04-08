"use client";

import { useCallback, useEffect, useState } from "react";
import { FeedSource } from "@/lib/types";

type FilterMode = "all" | "healthy" | "failed" | "unknown";

interface SiteUserInfo {
  username: string;
  createdAt: string;
}

interface FeedSuggestion {
  sourceUrl: string;
  suggestedFeedUrl: string | null;
  suggestedWebsite: string | null;
  preflightOk: boolean;
  reason: string | null;
  checkedAt: string;
}

export default function OwnerFeedsPage() {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [health, setHealth] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Site access control state
  const [suggestions, setSuggestions] = useState<FeedSuggestion[]>([]);
  const [rescanning, setRescanning] = useState(false);
  const [siteUsers, setSiteUsers] = useState<SiteUserInfo[]>([]);
  const [protectionEnabled, setProtectionEnabled] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [authStatusMessage, setAuthStatusMessage] = useState("");

  const fetchSources = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/sources");
    const data = await res.json();
    setSources(data.sources ?? []);
    if (data.health) setHealth(data.health);
    if (data.suggestions) setSuggestions(data.suggestions);
    setLoading(false);
  }, []);

  const suggestionsByUrl: Record<string, FeedSuggestion> = {};
  for (const s of suggestions) suggestionsByUrl[s.sourceUrl] = s;

  async function handleRescanFailed() {
    setRescanning(true);
    setStatusMessage("Triaging failed feeds...");
    const res = await fetch("/api/admin/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rescan_failed" }),
    });
    const data = await res.json();
    if (data.suggestions) setSuggestions(data.suggestions);
    if (res.ok) {
      const results: Array<{ status: string }> = data.results ?? [];
      const adds = results.filter((r) => r.status === "recommend_add").length;
      const dels = results.filter((r) => r.status === "recommend_deletion").length;
      const manual = results.filter((r) => r.status === "manual_review").length;
      setStatusMessage(
        `Triaged ${data.scanned ?? 0} failed feeds: ${adds} recommend add, ${dels} recommend deletion, ${manual} manual review.`,
      );
    } else {
      setStatusMessage(data.error ?? "Rescan failed.");
    }
    setRescanning(false);
  }

  async function handleApproveSuggestion(source: FeedSource, suggestion: FeedSuggestion) {
    if (!suggestion.suggestedFeedUrl) return;
    await doAction("approve_suggestion", {
      oldUrl: source.url,
      newUrl: suggestion.suggestedFeedUrl,
      newWebsite: suggestion.suggestedWebsite ?? source.website,
      name: source.name,
    });
    const res = await fetch("/api/admin/sources");
    const data = await res.json();
    if (data.suggestions) setSuggestions(data.suggestions);
  }

  async function handleDismissSuggestion(oldUrl: string) {
    await doAction("dismiss_suggestion", { oldUrl });
    setSuggestions((prev) => prev.filter((s) => s.sourceUrl !== oldUrl));
  }

  async function handleDeleteDeadSource(source: FeedSource) {
    const confirmed = window.confirm(
      `The site at ${source.website} appears to be dead. Delete this source permanently?`,
    );
    if (!confirmed) return;
    await doAction("delete_dead_source", { url: source.url });
    setSuggestions((prev) => prev.filter((s) => s.sourceUrl !== source.url));
  }

  const fetchSiteAuth = useCallback(async () => {
    const res = await fetch("/api/admin/site-auth");
    const data = await res.json();
    setSiteUsers(data.users ?? []);
    setProtectionEnabled(data.protectionEnabled ?? false);
  }, []);

  useEffect(() => { fetchSources(); fetchSiteAuth(); }, [fetchSources, fetchSiteAuth]);

  async function doAction(action: string, payload: Record<string, string>) {
    setBusy(true);
    setStatusMessage("");
    const res = await fetch("/api/admin/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json();
    if (data.sources) setSources(data.sources);

    if (!res.ok) {
      setStatusMessage(data.error ?? "Action failed.");
    } else if (data.discovery?.message) {
      setStatusMessage(data.discovery.message);
    } else {
      setStatusMessage("Saved.");
    }
    setBusy(false);
  }

  async function doAuthAction(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setAuthStatusMessage("");
    const res = await fetch("/api/admin/site-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json();

    if (!res.ok) {
      setAuthStatusMessage(data.error ?? "Action failed.");
    } else {
      if (data.users) setSiteUsers(data.users);
      if (typeof data.protectionEnabled === "boolean") setProtectionEnabled(data.protectionEnabled);
      setAuthStatusMessage(data.message ?? "Saved.");
    }
    setBusy(false);
  }

  async function handleAddFeed(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newUrl) return;
    await doAction("add", { name: newName, url: newUrl, website: newWebsite || newUrl });
    setNewName("");
    setNewUrl("");
    setNewWebsite("");
  }

  async function handleAddFromStore(e: React.FormEvent) {
    e.preventDefault();
    if (!storeName || !storeUrl) return;
    await doAction("add_from_store", { name: storeName, storeUrl });
    setStoreName("");
    setStoreUrl("");
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    await doAuthAction("add_user", { username: newUsername, password: newPassword });
    setNewUsername("");
    setNewPassword("");
  }

  function handleExportCsv() {
    window.location.href = "/api/admin/sources/csv";
  }

  function getStatus(url: string): string {
    return health[url] ?? "unknown";
  }

  const hasHealth = Object.keys(health).length > 0;
  const healthyCount = sources.filter((s) => getStatus(s.url) === "ok").length;
  const failedCount = sources.filter((s) => getStatus(s.url) === "error").length;
  const unknownCount = sources.length - healthyCount - failedCount;

  let filtered = search
    ? sources.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.url.toLowerCase().includes(search.toLowerCase())
    )
    : sources;

  if (filterMode === "healthy") filtered = filtered.filter((s) => getStatus(s.url) === "ok");
  if (filterMode === "failed") filtered = filtered.filter((s) => getStatus(s.url) === "error");
  if (filterMode === "unknown") filtered = filtered.filter((s) => getStatus(s.url) === "unknown");

  const enabledCount = sources.filter((s) => s.enabled !== false).length;
  const disabledCount = sources.length - enabledCount;

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight">Owner Feed Admin</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            MASTER list: {sources.length} sources ({enabledCount} enabled, {disabledCount} disabled)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
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

      {/* Site Access Control Section */}
      <div className="mb-8 p-4 rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Site Access Control</h2>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            protectionEnabled
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          }`}>
            {protectionEnabled ? "ON" : "OFF"}
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {protectionEnabled
            ? "Site is password-protected. Visitors must log in."
            : "Site is public. Anyone can access it."}
          {" "}Automatically enabled when <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">OWNER_PASSWORD</code> is set.
        </p>

        {protectionEnabled && siteUsers.length === 0 && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-3 font-medium">
            Warning: Protection is enabled but no users exist. Nobody will be able to access the site.
          </p>
        )}

        {authStatusMessage && (
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">{authStatusMessage}</p>
        )}

        <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            autoComplete="off"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            required
            disabled={busy}
          />
          <input
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            required
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm disabled:opacity-50"
          >
            Add User
          </button>
        </form>

        {siteUsers.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800/50">
            {siteUsers.map((user) => (
              <div key={user.username} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm font-medium">{user.username}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                    added {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => doAuthAction("remove_user", { username: user.username })}
                  disabled={busy}
                  className="text-xs text-red-400 hover:text-red-600 transition"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {statusMessage && (
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{statusMessage}</p>
      )}

      {hasHealth && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1.5 rounded-lg text-xs transition ${filterMode === "all" ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}
          >
            All ({sources.length})
          </button>
          <button
            onClick={() => setFilterMode("healthy")}
            className={`px-3 py-1.5 rounded-lg text-xs transition ${filterMode === "healthy" ? "bg-emerald-600 text-white" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"}`}
          >
            Healthy ({healthyCount})
          </button>
          <button
            onClick={() => setFilterMode("failed")}
            className={`px-3 py-1.5 rounded-lg text-xs transition ${filterMode === "failed" ? "bg-red-600 text-white" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"}`}
          >
            Failed ({failedCount})
          </button>
          <button
            onClick={() => setFilterMode("unknown")}
            className={`px-3 py-1.5 rounded-lg text-xs transition ${filterMode === "unknown" ? "bg-gray-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}
          >
            Unknown ({unknownCount})
          </button>
          {filterMode === "failed" && failedCount > 0 && (
            <button
              onClick={handleRescanFailed}
              disabled={rescanning || busy}
              className="ml-auto px-3 py-1.5 rounded-lg text-xs bg-amber-600 text-white disabled:opacity-50"
            >
              {rescanning ? "Rescanning..." : "Rescan failed feeds"}
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleAddFromStore} className="mb-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <p className="text-sm font-medium mb-3">Quick Add by Roaster Store URL</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder="Roaster name" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" required />
          <input type="url" placeholder="Store URL" value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} className="flex-[2] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" required />
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm disabled:opacity-50">Discover + Add</button>
        </div>
      </form>

      <form onSubmit={handleAddFeed} className="mb-6 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <p className="text-sm font-medium mb-3">Manual Add by Feed URL</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder="Roaster name" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" required />
          <input type="url" placeholder="Feed URL (.atom or rss)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="flex-[2] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" required />
          <input type="url" placeholder="Website (optional)" value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm disabled:opacity-50">Add</button>
        </div>
      </form>

      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Search sources..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800/50">
          {filtered.map((source) => {
            const status = getStatus(source.url);
            const suggestion = suggestionsByUrl[source.url];
            return (
              <div key={source.url} className={`${source.enabled === false ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-4 px-4 py-3">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status === "ok" ? "bg-emerald-500" : status === "error" ? "bg-red-400" : "bg-gray-300 dark:bg-gray-600"}`} />
                  <button onClick={() => doAction("toggle", { url: source.url })} disabled={busy} className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 ${source.enabled !== false ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}><div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${source.enabled !== false ? "translate-x-3.5" : "translate-x-0.5"}`} /></button>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{source.name}</p><p className="text-xs text-gray-400 dark:text-gray-500 truncate">{source.url}</p></div>
                  <a href={source.website} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition flex-shrink-0">Visit</a>
                  <button onClick={() => doAction("remove", { url: source.url })} disabled={busy} className="text-xs text-red-400 hover:text-red-600 transition flex-shrink-0">Remove</button>
                </div>
                {suggestion && (() => {
                  const isRecommendAdd =
                    suggestion.reason === "recommend_add" &&
                    suggestion.preflightOk &&
                    !!suggestion.suggestedFeedUrl;
                  const isRecommendDeletion = suggestion.reason === "site_dead";
                  const isManualReview = suggestion.reason === "manual_review";

                  if (isRecommendAdd) {
                    return (
                      <div className="mx-4 mb-3 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10">
                        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 mb-1">
                          Recommend add: discovered working feed
                        </p>
                        <p className="text-xs text-gray-700 dark:text-gray-200 break-all">→ {suggestion.suggestedFeedUrl}</p>
                        {suggestion.suggestedWebsite && (
                          <p className="text-xs text-gray-500 break-all">website: {suggestion.suggestedWebsite}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleApproveSuggestion(source, suggestion)}
                            disabled={busy}
                            className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs disabled:opacity-50"
                          >
                            Approve &amp; replace
                          </button>
                          <button
                            onClick={() => handleDismissSuggestion(source.url)}
                            disabled={busy}
                            className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-xs"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (isRecommendDeletion) {
                    return (
                      <div className="mx-4 mb-3 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-900/10">
                        <p className="text-xs font-medium text-red-800 dark:text-red-300 mb-1">
                          Recommend deletion: site appears dead
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          The root URL is unreachable, returns an error, or redirects off-domain.
                        </p>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleDeleteDeadSource(source)}
                            disabled={busy}
                            className="px-3 py-1 rounded-md bg-red-600 text-white text-xs disabled:opacity-50"
                          >
                            Delete source
                          </button>
                          <button
                            onClick={() => handleDismissSuggestion(source.url)}
                            disabled={busy}
                            className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-xs"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (isManualReview) {
                    return (
                      <div className="mx-4 mb-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Manual review needed
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Site is alive but no feed could be reconstructed automatically.
                        </p>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleDismissSuggestion(source.url)}
                            disabled={busy}
                            className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-xs"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // Fallback for legacy suggestions from the old suggestReplacementsForFailed path.
                  return (
                    <div className="mx-4 mb-3 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10">
                      {suggestion.suggestedFeedUrl && suggestion.preflightOk ? (
                        <>
                          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Suggested replacement feed (preflight passed)</p>
                          <p className="text-xs text-gray-700 dark:text-gray-200 break-all">→ {suggestion.suggestedFeedUrl}</p>
                          {suggestion.suggestedWebsite && (
                            <p className="text-xs text-gray-500 break-all">website: {suggestion.suggestedWebsite}</p>
                          )}
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleApproveSuggestion(source, suggestion)}
                              disabled={busy}
                              className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs disabled:opacity-50"
                            >
                              Approve &amp; replace
                            </button>
                            <button
                              onClick={() => handleDismissSuggestion(source.url)}
                              disabled={busy}
                              className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-xs"
                            >
                              Dismiss
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            No valid replacement found{suggestion.reason ? ` (${suggestion.reason})` : ""}.
                          </p>
                          <button
                            onClick={() => handleDismissSuggestion(source.url)}
                            disabled={busy}
                            className="px-2 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-xs"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

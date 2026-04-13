"use client";

import { useOwnerSources } from "@/components/owner-feeds/useOwnerSources";
import { useOwnerFilters } from "@/components/owner-feeds/useOwnerFilters";
import { useOwnerActions } from "@/components/owner-feeds/useOwnerActions";
import { useOwnerCron } from "@/components/owner-feeds/useOwnerCron";
import { useOwnerAuth } from "@/components/owner-feeds/useOwnerAuth";
import { OwnerPageHeader } from "@/components/owner-feeds/OwnerPageHeader";
import { SiteAccessControl } from "@/components/owner-feeds/SiteAccessControl";
import { FeedFilterBar } from "@/components/owner-feeds/FeedFilterBar";
import { QuickAddForm } from "@/components/owner-feeds/QuickAddForm";
import { AddFeedForm } from "@/components/owner-feeds/AddFeedForm";
import { SourceList } from "@/components/owner-feeds/SourceList";

export default function OwnerFeedsPage() {
  const { sources, health, loading, suggestionsByUrl, setSources, setSuggestions, fetchSources } = useOwnerSources();
  const filters = useOwnerFilters(sources, health);
  const actions = useOwnerActions({ setSources, setSuggestions });
  const cron = useOwnerCron({ setSuggestions, fetchSources, setStatusMessage: actions.setStatusMessage });
  const auth = useOwnerAuth();

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <OwnerPageHeader
        sourceCount={sources.length} enabledCount={filters.enabledCount} disabledCount={filters.disabledCount}
        cronRunning={cron.cronRunning} busy={actions.busy}
        onRunCron={cron.handleRunCron} onExportCsv={() => { window.location.href = "/api/admin/sources/csv"; }}
      />
      <SiteAccessControl
        siteUsers={auth.siteUsers} protectionEnabled={auth.protectionEnabled}
        authStatusMessage={auth.authStatusMessage} busy={actions.busy || auth.authBusy}
        onAuthAction={auth.doAuthAction}
      />
      {actions.statusMessage && (
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{actions.statusMessage}</p>
      )}
      {filters.hasHealth && (
        <FeedFilterBar
          filterMode={filters.filterMode} onSetFilterMode={filters.setFilterMode}
          sourceCount={sources.length} healthyCount={filters.healthyCount}
          failedCount={filters.failedCount} unknownCount={filters.unknownCount}
          rescanning={cron.rescanning} busy={actions.busy} onRescanFailed={cron.handleRescanFailed}
        />
      )}
      <QuickAddForm busy={actions.busy} doAction={actions.doAction} />
      <AddFeedForm busy={actions.busy} doAction={actions.doAction} />
      <div className="relative mb-4">
        <input
          type="text" placeholder="Search sources..." value={filters.search}
          onChange={(e) => filters.setSearch(e.target.value)}
          className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        />
      </div>
      <SourceList
        loading={loading} sources={filters.filtered} health={health}
        suggestionsByUrl={suggestionsByUrl} busy={actions.busy}
        doAction={actions.doAction} dismissSuggestion={actions.dismissSuggestion}
        fetchSources={fetchSources}
      />
    </div>
  );
}

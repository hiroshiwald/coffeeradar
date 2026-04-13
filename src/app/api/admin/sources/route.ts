import { NextRequest, NextResponse } from "next/server";
import {
  hasTurso,
  upsertFeedSuggestion,
  listFeedSuggestions,
  deleteFeedSuggestion,
} from "@/lib/db";
import {
  addOrUpdateMasterSource,
  getSourceHealth,
  listMasterSources,
  removeMasterSource,
  toggleMasterSource,
} from "@/lib/sourceStore";
import { discoverFeedFromStoreUrl } from "@/lib/feedDiscovery";
import { triageFailedFeeds, TriageResult } from "@/lib/feedTriage";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getSourceHealth();
  const sources = await listMasterSources();
  const suggestions = hasTurso() ? await listFeedSuggestions() : [];
  return NextResponse.json({ sources, health, suggestions });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  if (action === "add_from_store") {
    const { name, storeUrl } = body;
    if (!name || !storeUrl) {
      return NextResponse.json({ error: "Name and store URL are required" }, { status: 400 });
    }

    const discovery = await discoverFeedFromStoreUrl(storeUrl);
    if (!discovery.ok || !discovery.feedUrl) {
      return NextResponse.json({
        error: discovery.message,
        discovery,
      }, { status: 422 });
    }

    const sources = await addOrUpdateMasterSource({
      name,
      url: discovery.feedUrl,
      website: discovery.website,
      enabled: true,
    });

    return NextResponse.json({ sources, discovery });
  }

  if (action === "rescan_failed") {
    const health = await getSourceHealth();
    const all = await listMasterSources();
    const failed = all.filter((s) => health[s.url] === "error" && s.enabled !== false);

    const results: TriageResult[] = await triageFailedFeeds(failed);

    if (hasTurso()) {
      for (const r of results) {
        await upsertFeedSuggestion({
          sourceUrl: r.sourceUrl,
          suggestedFeedUrl: r.discoveredFeedUrl ?? null,
          suggestedWebsite: r.discoveredWebsite ?? null,
          preflightOk: r.status === "recommend_add",
          reason:
            r.status === "recommend_add"
              ? "recommend_add"
              : r.status === "recommend_deletion"
                ? "site_dead"
                : "manual_review",
        });
      }
    }

    const suggestions = hasTurso() ? await listFeedSuggestions() : [];
    return NextResponse.json({ scanned: failed.length, results, suggestions });
  }

  if (action === "delete_dead_source") {
    const { url } = body;
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
    await removeMasterSource(url);
    if (hasTurso()) await deleteFeedSuggestion(url);
    const sources = await listMasterSources();
    const suggestions = hasTurso() ? await listFeedSuggestions() : [];
    return NextResponse.json({ sources, suggestions });
  }

  if (action === "approve_suggestion") {
    const { oldUrl, newUrl, newWebsite, name } = body;
    if (!oldUrl || !newUrl || !name) {
      return NextResponse.json({ error: "oldUrl, newUrl, and name are required" }, { status: 400 });
    }
    await addOrUpdateMasterSource({
      name,
      url: newUrl,
      website: newWebsite || newUrl,
      enabled: true,
    });
    if (oldUrl !== newUrl) {
      await removeMasterSource(oldUrl);
    }
    if (hasTurso()) {
      await deleteFeedSuggestion(oldUrl);
    }
    const sources = await listMasterSources();
    const suggestions = hasTurso() ? await listFeedSuggestions() : [];
    return NextResponse.json({ sources, suggestions });
  }

  if (action === "dismiss_suggestion") {
    const { oldUrl } = body;
    if (!oldUrl) return NextResponse.json({ error: "oldUrl required" }, { status: 400 });
    if (hasTurso()) await deleteFeedSuggestion(oldUrl);
    const suggestions = hasTurso() ? await listFeedSuggestions() : [];
    return NextResponse.json({ suggestions });
  }

  switch (action) {
    case "add": {
      const { name, url, website } = body;
      if (!name || !url) {
        return NextResponse.json({ error: "Name and URL are required" }, { status: 400 });
      }
      const sources = await addOrUpdateMasterSource({ name, url, website: website || url, enabled: true });
      return NextResponse.json({ sources });
    }
    case "remove": {
      const sources = await removeMasterSource(body.url);
      return NextResponse.json({ sources });
    }
    case "toggle": {
      const sources = await toggleMasterSource(body.url);
      return NextResponse.json({ sources });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

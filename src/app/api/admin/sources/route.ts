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

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isValidUrl(v: unknown): v is string {
  if (!isNonEmptyString(v)) return false;
  try { new URL(v); return true; } catch { return false; }
}

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getSourceHealth();
  const sources = await listMasterSources();
  const suggestions = hasTurso() ? await listFeedSuggestions() : [];
  return NextResponse.json({ sources, health, suggestions });
}

async function handleAddFromStore(body: Record<string, unknown>) {
  const { name, storeUrl } = body;
  if (!isNonEmptyString(name) || !isValidUrl(storeUrl)) {
    return NextResponse.json({ error: "name must be a non-empty string and storeUrl must be a valid URL" }, { status: 400 });
  }

  const discovery = await discoverFeedFromStoreUrl(storeUrl);
  if (!discovery.ok || !discovery.feedUrl) {
    return NextResponse.json({ error: discovery.message, discovery }, { status: 422 });
  }

  const sources = await addOrUpdateMasterSource({
    name,
    url: discovery.feedUrl,
    website: discovery.website,
    enabled: true,
  });
  return NextResponse.json({ sources, discovery });
}

async function handleRescanFailed() {
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

async function handleDeleteDeadSource(body: Record<string, unknown>) {
  const { url } = body;
  if (!isValidUrl(url)) return NextResponse.json({ error: "url must be a valid URL" }, { status: 400 });
  await removeMasterSource(url);
  if (hasTurso()) await deleteFeedSuggestion(url);
  const sources = await listMasterSources();
  const suggestions = hasTurso() ? await listFeedSuggestions() : [];
  return NextResponse.json({ sources, suggestions });
}

async function handleApproveSuggestion(body: Record<string, unknown>) {
  const { oldUrl, newUrl, newWebsite, name } = body;
  if (!isValidUrl(oldUrl) || !isValidUrl(newUrl) || !isNonEmptyString(name)) {
    return NextResponse.json({ error: "oldUrl and newUrl must be valid URLs, name must be a non-empty string" }, { status: 400 });
  }
  if (newWebsite !== undefined && !isValidUrl(newWebsite)) {
    return NextResponse.json({ error: "newWebsite must be a valid URL if provided" }, { status: 400 });
  }
  await addOrUpdateMasterSource({
    name,
    url: newUrl,
    website: (newWebsite as string) || newUrl,
    enabled: true,
  });
  if (oldUrl !== newUrl) {
    await removeMasterSource(oldUrl as string);
  }
  if (hasTurso()) {
    await deleteFeedSuggestion(oldUrl as string);
  }
  const sources = await listMasterSources();
  const suggestions = hasTurso() ? await listFeedSuggestions() : [];
  return NextResponse.json({ sources, suggestions });
}

async function handleDismissSuggestion(body: Record<string, unknown>) {
  const { oldUrl } = body;
  if (!isValidUrl(oldUrl)) return NextResponse.json({ error: "oldUrl must be a valid URL" }, { status: 400 });
  if (hasTurso()) await deleteFeedSuggestion(oldUrl);
  const suggestions = hasTurso() ? await listFeedSuggestions() : [];
  return NextResponse.json({ suggestions });
}

async function handleAdd(body: Record<string, unknown>) {
  const { name, url, website } = body;
  if (!isNonEmptyString(name) || !isValidUrl(url)) {
    return NextResponse.json({ error: "name must be a non-empty string and url must be a valid URL" }, { status: 400 });
  }
  if (website !== undefined && !isValidUrl(website)) {
    return NextResponse.json({ error: "website must be a valid URL if provided" }, { status: 400 });
  }
  const sources = await addOrUpdateMasterSource({ name, url, website: (website as string) || url, enabled: true });
  return NextResponse.json({ sources });
}

async function handleRemove(body: Record<string, unknown>) {
  if (!isValidUrl(body.url)) {
    return NextResponse.json({ error: "url must be a valid URL" }, { status: 400 });
  }
  const sources = await removeMasterSource(body.url);
  return NextResponse.json({ sources });
}

async function handleToggle(body: Record<string, unknown>) {
  if (!isValidUrl(body.url)) {
    return NextResponse.json({ error: "url must be a valid URL" }, { status: 400 });
  }
  const sources = await toggleMasterSource(body.url);
  return NextResponse.json({ sources });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid or missing JSON body" }, { status: 400 });
  }
  const { action } = body;

  if (!isNonEmptyString(action)) {
    return NextResponse.json({ error: "action must be a non-empty string" }, { status: 400 });
  }

  switch (action) {
    case "add_from_store":     return handleAddFromStore(body);
    case "rescan_failed":      return handleRescanFailed();
    case "delete_dead_source": return handleDeleteDeadSource(body);
    case "approve_suggestion": return handleApproveSuggestion(body);
    case "dismiss_suggestion": return handleDismissSuggestion(body);
    case "add":                return handleAdd(body);
    case "remove":             return handleRemove(body);
    case "toggle":             return handleToggle(body);
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { hasTurso, initDb, getFeedResults } from "@/lib/db";
import { getInMemoryHealth } from "@/lib/sources";
import { addOrUpdateMasterSource, listMasterSources, removeMasterSource, toggleMasterSource } from "@/lib/sourceStore";
import { discoverFeedFromStoreUrl } from "@/lib/feedDiscovery";

export const dynamic = "force-dynamic";

export async function GET() {
  let health: Record<string, string> = {};
  if (hasTurso()) {
    await initDb();
    health = await getFeedResults();
  } else {
    health = getInMemoryHealth();
  }

  const sources = await listMasterSources();
  return NextResponse.json({ sources, health });
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

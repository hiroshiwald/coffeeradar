import { NextRequest, NextResponse } from "next/server";
import { getSources, addSource, removeSource, toggleSource } from "@/lib/sources";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ sources: getSources() });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  switch (action) {
    case "add": {
      const { name, url, website } = body;
      if (!name || !url) {
        return NextResponse.json({ error: "Name and URL are required" }, { status: 400 });
      }
      const sources = addSource({ name, url, website: website || url, enabled: true });
      return NextResponse.json({ sources });
    }
    case "remove": {
      const sources = removeSource(body.url);
      return NextResponse.json({ sources });
    }
    case "toggle": {
      const sources = toggleSource(body.url);
      return NextResponse.json({ sources });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

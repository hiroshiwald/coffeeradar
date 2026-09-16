import { NextRequest, NextResponse } from "next/server";
import { validateTipLinkInput } from "@/lib/tipLink";
import { readTipLinkSettings, writeTipLinkSettings } from "@/lib/tipLinkStore";

// Owner-only: middleware.ts guards every /api/admin path with Basic Auth.
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await readTipLinkSettings();
  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid or missing JSON body" }, { status: 400 });
  }

  const parsed = validateTipLinkInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await writeTipLinkSettings(parsed.settings);
  const message = parsed.settings.enabled ? "Tip link is showing on the site." : "Tip link is hidden.";
  return NextResponse.json({ ...parsed.settings, message });
}

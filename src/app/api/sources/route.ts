import { NextRequest, NextResponse } from "next/server";
import { getSourceHealth, listMasterSources } from "@/lib/sourceStore";
import { checkSiteAuthFromRequest } from "@/lib/authGuard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { authorized } = await checkSiteAuthFromRequest(request);
  if (!authorized) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const health = await getSourceHealth();
  const sources = await listMasterSources();
  return NextResponse.json({ sources, health });
}

import { NextRequest, NextResponse } from "next/server";
import { hasTurso, initDb, getFeedResults } from "@/lib/db";
import { getInMemoryHealth } from "@/lib/sources";
import { listMasterSources } from "@/lib/sourceStore";
import { checkSiteAuthFromRequest } from "@/lib/authGuard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { authorized } = await checkSiteAuthFromRequest(request);
  if (!authorized) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
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

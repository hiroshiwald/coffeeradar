import { NextResponse } from "next/server";
import { hasTurso, initDb, getFeedResults } from "@/lib/db";
import { getInMemoryHealth } from "@/lib/sources";
import { listMasterSources } from "@/lib/sourceStore";

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

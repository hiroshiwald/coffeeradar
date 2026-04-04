import { NextResponse } from "next/server";
import { isSiteProtectionEnabled } from "@/lib/siteAuthStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = await isSiteProtectionEnabled();
  return NextResponse.json({ enabled });
}

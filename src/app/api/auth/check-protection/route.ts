import { NextResponse } from "next/server";
import { isSiteProtectionEnabled } from "@/lib/siteAuthStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = await isSiteProtectionEnabled();
  return NextResponse.json(
    { enabled, checkedAt: Date.now() },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

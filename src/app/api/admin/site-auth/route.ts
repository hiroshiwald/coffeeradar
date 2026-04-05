import { NextRequest, NextResponse } from "next/server";
import { listSiteUsers, addSiteUser, removeSiteUser } from "@/lib/siteAuthStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const users = await listSiteUsers();
  const protectionEnabled = process.env.SITE_PROTECTION_ENABLED === "true";
  return NextResponse.json({ users, protectionEnabled });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  switch (action) {
    case "add_user": {
      const { username, password } = body;
      if (!username || !password) return NextResponse.json({ error: "Required." }, { status: 400 });
      await addSiteUser(username.trim(), password);
      const users = await listSiteUsers();
      return NextResponse.json({ users, message: `User "${username}" added.` });
    }
    case "remove_user": {
      const { username } = body;
      if (!username) return NextResponse.json({ error: "Required." }, { status: 400 });
      await removeSiteUser(username);
      const users = await listSiteUsers();
      return NextResponse.json({ users, message: `User "${username}" removed.` });
    }
    case "set_protection": {
      return NextResponse.json(
        { error: "Protection is controlled via the SITE_PROTECTION_ENABLED environment variable. Update it in your hosting dashboard and redeploy." },
        { status: 400 }
      );
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}

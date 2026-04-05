import { NextRequest, NextResponse } from "next/server";
import { listSiteUsers, addSiteUser, removeSiteUser, isSiteProtectionEnabled, setSiteProtection } from "@/lib/siteAuthStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const [users, protectionEnabled] = await Promise.all([listSiteUsers(), isSiteProtectionEnabled()]);
  return NextResponse.json({
    users,
    protectionEnabled,
    persistentStoreAvailable: true, // Forced true so the UI allows toggling locally
    storageMode: "local-file-fallback",
  });
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
      const { enabled } = body;
      await setSiteProtection(enabled);
      return NextResponse.json({ protectionEnabled: enabled });
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}

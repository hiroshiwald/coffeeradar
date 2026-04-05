import { NextRequest, NextResponse } from "next/server";
import {
  listSiteUsers,
  addSiteUser,
  removeSiteUser,
  isSiteProtectionEnabled,
  setSiteProtection,
  hasPersistentSiteAuthStore,
} from "@/lib/siteAuthStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const [users, protectionEnabled] = await Promise.all([
    listSiteUsers(),
    isSiteProtectionEnabled(),
  ]);
  const persistentStoreAvailable = hasPersistentSiteAuthStore();
  return NextResponse.json({
    users,
    protectionEnabled,
    persistentStoreAvailable,
    storageMode: persistentStoreAvailable ? "turso" : "in-memory",
    warning: persistentStoreAvailable
      ? undefined
      : "Site auth is using in-memory storage. Protection settings and users are not reliable across server instances.",
  });
}

export async function POST(request: NextRequest) {
  if (!hasPersistentSiteAuthStore()) {
    return NextResponse.json(
      {
        error:
          "Site protection requires Turso persistence. Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before changing site access settings.",
      },
      { status: 503 }
    );
  }

  const body = await request.json();
  const { action } = body;

  switch (action) {
    case "add_user": {
      const { username, password } = body;
      if (!username || !password) {
        return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
      }
      if (username.length < 2 || password.length < 4) {
        return NextResponse.json({ error: "Username must be 2+ chars, password 4+ chars." }, { status: 400 });
      }
      await addSiteUser(username.trim(), password);
      const users = await listSiteUsers();
      return NextResponse.json({ users, message: `User "${username}" added.` });
    }
    case "remove_user": {
      const { username } = body;
      if (!username) {
        return NextResponse.json({ error: "Username is required." }, { status: 400 });
      }
      await removeSiteUser(username);
      const users = await listSiteUsers();
      return NextResponse.json({ users, message: `User "${username}" removed.` });
    }
    case "set_protection": {
      const { enabled } = body;
      if (typeof enabled !== "boolean") {
        return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });
      }
      await setSiteProtection(enabled);
      return NextResponse.json({ protectionEnabled: enabled });
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}

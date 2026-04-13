import { NextRequest, NextResponse } from "next/server";
import { validateSiteUser } from "@/lib/siteAuthStore";
import { createSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { username, password } = body;

  if (typeof username !== "string" || !username.trim() || typeof password !== "string" || !password.trim()) {
    return NextResponse.json({ error: "Username and password must be non-empty strings." }, { status: 400 });
  }

  const valid = await validateSiteUser(username, password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const cookie = await createSessionCookie(username);
  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
}

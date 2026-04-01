import { NextRequest, NextResponse } from "next/server";

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Owner Area"' },
  });
}

export function middleware(req: NextRequest): NextResponse {
  const expectedUser = process.env.OWNER_USERNAME;
  const expectedPass = process.env.OWNER_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return new NextResponse("Owner credentials are not configured.", { status: 503 });
  }

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return unauthorizedResponse();

  const base64 = auth.slice(6);
  const decoded = atob(base64);
  const separator = decoded.indexOf(":");
  if (separator < 0) return unauthorizedResponse();

  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  if (username !== expectedUser || password !== expectedPass) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/owner/:path*", "/api/admin/:path*"],
};

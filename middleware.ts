import { NextRequest, NextResponse } from "next/server";

const getEnvAllowedOrigins = (): Set<string> => {
  const allowed = new Set<string>();

  if (process.env.NEXT_PUBLIC_APP_URL) {
    allowed.add(process.env.NEXT_PUBLIC_APP_URL);
  }

  if (process.env.VERCEL_URL) {
    allowed.add(`https://${process.env.VERCEL_URL}`);
  }

  return allowed;
};

const ALLOWED_FROM_ENV = getEnvAllowedOrigins();

const isAllowedReferer = (referer: string | null, allowedOrigins: Set<string>) => {
  if (!referer) return false;

  try {
    const refererUrl = new URL(referer);
    return allowedOrigins.has(`${refererUrl.protocol}//${refererUrl.host}`);
  } catch {
    return false;
  }
};

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204 });
  }

  const allowedOrigins = new Set(ALLOWED_FROM_ENV);
  allowedOrigins.add(req.nextUrl.origin);

  const incomingOrigin = req.headers.get("origin");
  const isAllowedOrigin =
    incomingOrigin !== null && allowedOrigins.has(incomingOrigin);
  const isRefererAllowed = isAllowedReferer(
    req.headers.get("referer"),
    allowedOrigins,
  );

  if (!isAllowedOrigin && !isRefererAllowed) {
    return NextResponse.json(
      { error: "Forbidden - invalid Origin/Referer" },
      { status: 403 },
    );
  }

  if (req.method === "POST") {
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("application/json")) {
      return NextResponse.json(
        { error: "Unsupported Media Type" },
        { status: 415 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};

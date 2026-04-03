// Middleware to protect the API routes
import { NextRequest, NextResponse } from "next/server";

const getAllowedOrigins = (): Set<string> => {
  const s = new Set<string>();

  // Add explicit env override (optional)
  // e.g. NEXT_PUBLIC_APP_URL=https://yourapp.example
  if (process.env.NEXT_PUBLIC_APP_URL) {
    s.add(process.env.NEXT_PUBLIC_APP_URL);
  }

  // If deploying on Vercel, allow the (preview) host returned in VERCEL_URL
  if (process.env.VERCEL_URL) {
    s.add(`https://${process.env.VERCEL_URL}`);
  }

  return s;
};

const ALLOWED_FROM_ENV = getAllowedOrigins();

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  // Let OPTIONS preflights pass
  if (req.method === "OPTIONS") return new NextResponse(null, { status: 204 });

  // Allow root path without origin checks (optional)
  if (req.nextUrl.pathname === "/") return NextResponse.next();

  // Get the incoming Origin header (may be null for same-origin navigations)
  const incomingOrigin = req.headers.get("origin");

  // Derive this app's runtime origin from the request URL.
  // This handles dev and prod automatically (e.g., http://localhost:3000 or https://yourapp.example).
  const appOrigin = req.nextUrl.origin;

  // Build the allowed set for this request: appOrigin has priority (auto-injected)
  const allowed = new Set(ALLOWED_FROM_ENV);
  allowed.add(appOrigin);

  // For strictness: reject requests without Origin (they could be forms),
  // but many same-origin browser requests won't send Origin (so we allow referer fallback).
  if (!incomingOrigin) {
    // Try referer fallback (safer than outright deny).
    const referer = req.headers.get("referer");
    if (referer) {
      try {
        const u = new URL(referer);
        if (!allowed.has(`${u.protocol}//${u.host}`)) {
          return NextResponse.json(
            { error: "Forbidden — invalid Referer" },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Forbidden — invalid Referer" },
          { status: 403 }
        );
      }
    } else {
      // No Origin and no Referer — conservative block (prevents form PoC).
      return NextResponse.json(
        { error: "Forbidden — missing Origin/Referer" },
        { status: 403 }
      );
    }
  } else {
    // If incoming Origin is present, ensure it matches what we expect.
    if (!allowed.has(incomingOrigin)) {
      return NextResponse.json(
        { error: "Forbidden — invalid Origin" },
        { status: 403 }
      );
    }
  }

  // Additionally: for POSTs, enforce JSON content-type to block form posts
  if (req.method === "POST") {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.startsWith("application/json")) {
      return NextResponse.json(
        { error: "Unsupported Media Type" },
        { status: 415 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};

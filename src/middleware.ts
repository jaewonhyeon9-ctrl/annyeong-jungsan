import { NextResponse } from "next/server";

// Local demo mode: routing is handled in the client with mock profiles.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.png$).*)",
  ],
};

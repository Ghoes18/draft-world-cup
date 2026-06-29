import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCALE_COOKIE, localeCookieOptions } from "./app/_i18n/cookie";
import { detectLocaleFromHeader, parseLocaleCookie } from "./app/_i18n/detect";

export function middleware(request: NextRequest) {
  const existing = parseLocaleCookie(request.cookies.get(LOCALE_COOKIE)?.value);
  if (existing) return NextResponse.next();

  const detected = detectLocaleFromHeader(request.headers.get("accept-language"));
  const response = NextResponse.next();
  response.headers.append("Set-Cookie", localeCookieOptions(detected));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|catalog.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

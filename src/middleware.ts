import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const dashboardPath = /^\/([^/]+)\/(admin|exams|flashcards|analytics)/;
const superAdminPath = /^\/super-admin/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /super-admin routes
  if (superAdminPath.test(pathname)) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const login = new URL("/login", request.url);
      login.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(login);
    }
    if (token.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // Protect dashboard routes: /[tenantSlug]/admin|exams|flashcards|analytics
  const match = pathname.match(dashboardPath);
  if (match) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const login = new URL("/login", request.url);
      login.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(login);
    }
    const tenantSlug = match[1];
    if (token.tenantId) {
      const res = NextResponse.next();
      res.headers.set("x-tenant-id", token.tenantId as string);
      res.headers.set("x-tenant-slug", tenantSlug);
      return res;
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|signup|accept-invitation).*)"],
};

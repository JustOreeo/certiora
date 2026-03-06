import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const dashboardPath = /^\/([^/]+)\/(admin|exams|flashcards|analytics)/;
const tenantRootPath = /^\/([^/]+)$/; // exactly one segment: /:tenantSlug (student home)
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

  // Protect tenant root: /:tenantSlug (student home page)
  const tenantRootMatch = pathname.match(tenantRootPath);
  if (tenantRootMatch) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const login = new URL("/login", request.url);
      login.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(login);
    }
    const tenantSlug = tenantRootMatch[1];

    if (token.tenantId && token.tenantSlug && token.tenantSlug !== tenantSlug) {
      return NextResponse.redirect(new URL(`/${token.tenantSlug}`, request.url));
    }

    if (
      token.role === "STUDENT" &&
      token.credentialsExpiresAt &&
      new Date(token.credentialsExpiresAt as string) < new Date()
    ) {
      const login = new URL("/login", request.url);
      login.searchParams.set("error", "CredentialsExpired");
      login.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(login);
    }

    if (token.tenantId) {
      const res = NextResponse.next();
      res.headers.set("x-tenant-id", token.tenantId as string);
      res.headers.set("x-tenant-slug", tenantSlug);
      return res;
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

    // Tenant isolation: user must not access another tenant's slug
    if (token.tenantId && token.tenantSlug && token.tenantSlug !== tenantSlug) {
      const correctPath = `/${token.tenantSlug}${pathname.slice(tenantSlug.length)}`;
      return NextResponse.redirect(new URL(correctPath, request.url));
    }

    // Block expired student credentials at all entry points (not just login)
    if (
      token.role === "STUDENT" &&
      token.credentialsExpiresAt &&
      new Date(token.credentialsExpiresAt as string) < new Date()
    ) {
      const login = new URL("/login", request.url);
      login.searchParams.set("error", "CredentialsExpired");
      login.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(login);
    }

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

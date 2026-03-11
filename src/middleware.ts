import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const dashboardPath = /^\/([^/]+)\/(admin|exams|flashcards|analytics)/;
const tenantRootPath = /^\/([^/]+)$/;
const superAdminPath = /^\/super-admin/;

async function isTenantActive(slug: string, request: NextRequest): Promise<boolean> {
  try {
    const statusUrl = new URL(`/api/internal/tenant-status/${slug}`, request.url);
    const res = await fetch(statusUrl);
    if (!res.ok) return true;
    const data = await res.json();
    return data.isActive !== false;
  } catch {
    return true;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

    if (!(await isTenantActive(tenantSlug, request))) {
      return NextResponse.rewrite(new URL("/suspended", request.url));
    }

    return NextResponse.next();
  }

  const match = pathname.match(dashboardPath);
  if (match) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const login = new URL("/login", request.url);
      login.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(login);
    }
    const tenantSlug = match[1];

    if (token.tenantId && token.tenantSlug && token.tenantSlug !== tenantSlug) {
      const correctPath = `/${token.tenantSlug}${pathname.slice(tenantSlug.length)}`;
      return NextResponse.redirect(new URL(correctPath, request.url));
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

    if (!(await isTenantActive(tenantSlug, request))) {
      return NextResponse.rewrite(new URL("/suspended", request.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|signup|accept-invitation|suspended).*)"],
};

import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { loginRatelimit } from "@/lib/ratelimit";

const handler = NextAuth(authOptions);

export async function GET(request: NextRequest, context: { params: { nextauth: string[] } }) {
  return handler(request as any, context as any);
}

export async function POST(request: NextRequest, context: { params: { nextauth: string[] } }) {
  // Apply rate limiting to credentials sign-in attempts
  const isSignIn = context.params.nextauth?.includes("callback") || context.params.nextauth?.includes("signin");
  if (isSignIn && loginRatelimit) {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    const { success } = await loginRatelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
  }
  return handler(request as any, context as any);
}

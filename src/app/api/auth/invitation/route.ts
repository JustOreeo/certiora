import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { invitationRatelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  if (invitationRatelimit) {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    const { success } = await invitationRatelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
  }

  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: {
      email: true,
      role: true,
      tenantName: true,
      tenantSlug: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
  }

  if (invitation.usedAt) {
    return NextResponse.json({ error: "Invitation has already been used" }, { status: 410 });
  }

  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
  }

  return NextResponse.json({
    email: invitation.email,
    role: invitation.role,
    tenantName: invitation.tenantName,
    tenantSlug: invitation.tenantSlug,
  });
}

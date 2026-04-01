import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { z } from "zod";
import { ADMIN_INVITE_MAX_EXPIRY_DAYS } from "@/lib/invitation-config";

const resendSchema = z.object({
  expiresInDays: z.number().int().min(1).max(ADMIN_INVITE_MAX_EXPIRY_DAYS).default(7),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = resendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const invitation = await prisma.invitation.findUnique({
    where: { id: params.id },
    select: { id: true, role: true, usedAt: true },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invitation.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (invitation.usedAt) {
    return NextResponse.json({ error: "Cannot resend a used invitation" }, { status: 400 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parsed.data.expiresInDays);

  const updated = await prisma.invitation.update({
    where: { id: params.id },
    data: { token: randomBytes(32).toString("hex"), expiresAt },
    select: { token: true, expiresAt: true },
  });

  const invitationUrl = `/accept-invitation?token=${updated.token}`;
  return NextResponse.json({ invitationUrl, token: updated.token, expiresAt: updated.expiresAt });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invitation = await prisma.invitation.findUnique({
    where: { id: params.id },
    select: { id: true, role: true, usedAt: true },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invitation.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (invitation.usedAt) {
    return NextResponse.json({ error: "Cannot revoke a used invitation" }, { status: 400 });
  }

  await prisma.invitation.delete({ where: { id: params.id } });

  return new NextResponse(null, { status: 204 });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { z } from "zod";
import { STUDENT_INVITE_MAX_EXPIRY_DAYS } from "@/lib/invitation-config";
import { addEmailJob } from "@/lib/queue";
import { studentInvitationEmail } from "@/lib/email/templates";

const resendSchema = z.object({
  expiresInDays: z.number().int().min(1).max(STUDENT_INVITE_MAX_EXPIRY_DAYS).default(30),
});

async function resolveTenantAndAssertAccess(
  session: { role?: string; tenantId?: string | null },
  tenantSlug: string
) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, name: true },
  });
  if (!tenant) return null;
  if (session.tenantId !== tenant.id) return null;
  return tenant;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { tenantSlug: string; id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.role !== "ADMIN" && session.role !== "INSTRUCTOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await resolveTenantAndAssertAccess(session, params.tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = resendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const invitation = await prisma.invitation.findUnique({
    where: { id: params.id },
    select: { id: true, tenantId: true, role: true, usedAt: true, email: true },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invitation.tenantId !== tenant.id || invitation.role !== "STUDENT") {
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

  const inviterUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } });
  const emailTemplate = studentInvitationEmail({
    email: invitation.email,
    tenantName: tenant.name,
    inviterName: inviterUser?.name ?? null,
    token: updated.token,
    expiresAt: updated.expiresAt,
  });
  await addEmailJob({ to: invitation.email, ...emailTemplate });

  const invitationUrl = `/accept-invitation?token=${updated.token}`;
  return NextResponse.json({ invitationUrl, token: updated.token, expiresAt: updated.expiresAt });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { tenantSlug: string; id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.role !== "ADMIN" && session.role !== "INSTRUCTOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug },
    select: { id: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (session.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invitation = await prisma.invitation.findUnique({
    where: { id: params.id },
    select: { id: true, tenantId: true, role: true, usedAt: true },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invitation.tenantId !== tenant.id || invitation.role !== "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (invitation.usedAt) {
    return NextResponse.json({ error: "Cannot revoke a used invitation" }, { status: 400 });
  }

  await prisma.invitation.delete({ where: { id: params.id } });

  return new NextResponse(null, { status: 204 });
}

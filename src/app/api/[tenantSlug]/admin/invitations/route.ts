import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { randomBytes } from "crypto";
import { STUDENT_INVITE_DEFAULT_EXPIRY_DAYS, STUDENT_INVITE_MAX_EXPIRY_DAYS } from "@/lib/invitation-config";
import { addEmailJob } from "@/lib/queue";
import { studentInvitationEmail } from "@/lib/email/templates";

const schema = z.object({
  email: z.string().email("Valid email required"),
  expiresInDays: z.number().int().min(1).max(STUDENT_INVITE_MAX_EXPIRY_DAYS).default(STUDENT_INVITE_DEFAULT_EXPIRY_DAYS),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { tenantSlug: string } }
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

  const invitations = await prisma.invitation.findMany({
    where: { tenantId: tenant.id, role: "STUDENT" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      token: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      createdAt: true,
      inviter: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(invitations);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { tenantSlug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.role !== "ADMIN" && session.role !== "INSTRUCTOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantSlug },
    select: { id: true, name: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Ensure the admin belongs to this tenant
  if (session.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, expiresInDays } = parsed.data;

  // Check email not already registered
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "Email already registered" }, { status: 400 });
  }

  // Check no active pending invitation for this email in this tenant
  const existingInvite = await prisma.invitation.findFirst({
    where: {
      email,
      tenantId: tenant.id,
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (existingInvite) {
    return NextResponse.json(
      { error: "An active invitation already exists for this email" },
      { status: 400 }
    );
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const invitation = await prisma.invitation.create({
    data: {
      token: randomBytes(32).toString("hex"),
      email,
      role: "STUDENT",
      tenantId: tenant.id,
      invitedBy: session.user.id,
      expiresAt,
    },
  });

  const invitationUrl = `/accept-invitation?token=${invitation.token}`;

  const inviterUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } });
  const emailTemplate = studentInvitationEmail({
    email,
    tenantName: tenant.name,
    inviterName: inviterUser?.name ?? null,
    token: invitation.token,
    expiresAt,
  });
  await addEmailJob({ to: email, ...emailTemplate });

  return NextResponse.json({ invitationUrl, token: invitation.token }, { status: 201 });
}

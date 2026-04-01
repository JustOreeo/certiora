import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { randomBytes } from "crypto";
import { ADMIN_INVITE_DEFAULT_EXPIRY_DAYS, ADMIN_INVITE_MAX_EXPIRY_DAYS } from "@/lib/invitation-config";
import { addEmailJob } from "@/lib/queue";
import { adminInvitationEmail } from "@/lib/email/templates";

function requireSuperAdmin(session: Session | null) {
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

const createSchema = z.object({
  email: z.string().email("Valid email required"),
  tenantName: z.string().min(1, "Tenant name is required"),
  tenantSlug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  expiresInDays: z.number().int().min(1).max(ADMIN_INVITE_MAX_EXPIRY_DAYS).default(ADMIN_INVITE_DEFAULT_EXPIRY_DAYS),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  const err = requireSuperAdmin(session);
  if (err) return err;

  const invitations = await prisma.invitation.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      tenantName: true,
      tenantSlug: true,
      tenantId: true,
      token: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
      inviter: { select: { name: true, email: true } },
    },
  });

  const usedSlugs = invitations
    .filter((inv) => inv.usedAt && !inv.tenantId && inv.tenantSlug)
    .map((inv) => inv.tenantSlug!);

  const tenantsBySlug = new Map<string, string>();
  if (usedSlugs.length > 0) {
    const tenants = await prisma.tenant.findMany({
      where: { slug: { in: usedSlugs } },
      select: { id: true, slug: true },
    });
    for (const t of tenants) tenantsBySlug.set(t.slug, t.id);
  }

  const result = invitations.map((inv) => ({
    ...inv,
    tenantId:
      inv.tenantId ??
      (inv.tenantSlug ? tenantsBySlug.get(inv.tenantSlug) ?? null : null),
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = requireSuperAdmin(session);
  if (err) return err;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, tenantName, tenantSlug, expiresInDays } = parsed.data;

  // Check slug not already taken
  const existingTenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (existingTenant) {
    return NextResponse.json({ error: "This tenant slug is not available" }, { status: 400 });
  }

  // Check no pending invitation for same slug
  const existingInvite = await prisma.invitation.findFirst({
    where: { tenantSlug, usedAt: null, expiresAt: { gt: new Date() } },
  });
  if (existingInvite) {
    return NextResponse.json(
      { error: "This tenant slug is not available" },
      { status: 400 }
    );
  }

  // Check email not already registered
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "Email already registered" }, { status: 400 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const invitation = await prisma.invitation.create({
    data: {
      token: randomBytes(32).toString("hex"),
      email,
      role: "ADMIN",
      tenantName,
      tenantSlug,
      invitedBy: session!.user.id,
      expiresAt,
    },
  });

  const invitationUrl = `/accept-invitation?token=${invitation.token}`;

  const inviterUser = await prisma.user.findUnique({ where: { id: session!.user.id }, select: { name: true } });
  const emailTemplate = adminInvitationEmail({
    email,
    tenantName,
    inviterName: inviterUser?.name ?? null,
    token: invitation.token,
    expiresAt,
  });
  await addEmailJob({ to: email, ...emailTemplate });

  return NextResponse.json({ invitationUrl, token: invitation.token }, { status: 201 });
}

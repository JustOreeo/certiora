import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { seedTenantFsrsParams } from "@/lib/fsrs";
import { hash } from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(1),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { token, name, password } = parsed.data;

  const invitation = await prisma.invitation.findUnique({ where: { token } });

  if (!invitation) {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
  }

  if (invitation.usedAt) {
    return NextResponse.json({ error: "Invitation has already been used" }, { status: 410 });
  }

  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
  }

  // Check email not already registered
  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existingUser) {
    return NextResponse.json({ error: "Email already registered" }, { status: 400 });
  }

  const passwordHash = await hash(password, 10);

  if (invitation.role === "ADMIN") {
    if (!invitation.tenantName || !invitation.tenantSlug) {
      return NextResponse.json({ error: "Invalid admin invitation" }, { status: 400 });
    }

    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: invitation.tenantSlug },
    });
    if (existingTenant) {
      return NextResponse.json({ error: "Tenant slug already taken" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { slug: invitation.tenantSlug!, name: invitation.tenantName! },
      });

      await tx.fsrsParams.create({
        data: seedTenantFsrsParams(tenant.id),
      });

      await tx.user.create({
        data: {
          email: invitation.email,
          name,
          role: "ADMIN",
          tenantId: tenant.id,
          passwordHash,
        },
      });

      await tx.invitation.update({
        where: { token },
        data: { usedAt: new Date() },
      });
    });
  } else if (invitation.role === "STUDENT") {
    if (!invitation.tenantId) {
      return NextResponse.json({ error: "Invalid student invitation" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          email: invitation.email,
          name,
          role: "STUDENT",
          tenantId: invitation.tenantId,
          passwordHash,
        },
      });

      await tx.invitation.update({
        where: { token },
        data: { usedAt: new Date() },
      });
    });
  } else {
    return NextResponse.json({ error: "Invalid invitation role" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

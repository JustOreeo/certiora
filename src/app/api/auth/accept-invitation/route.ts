import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { seedTenantFsrsParams } from "@/lib/fsrs";
import { addAdminDeckOnboardJob } from "@/lib/queue";
import { hash } from "bcryptjs";
import { z } from "zod";
import { invitationRatelimit } from "@/lib/ratelimit";

const schema = z.object({
  token: z.string().min(1),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  if (invitationRatelimit) {
    const { success } = await invitationRatelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
  } else {
    console.warn(`[ratelimit] invitation POST bypassed for ip=${ip}`);
  }

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

    try {
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
          data: { usedAt: new Date(), tenantId: tenant.id },
        });
      });
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        return NextResponse.json({ error: "Tenant slug already taken" }, { status: 409 });
      }
      throw e;
    }
  } else if (invitation.role === "STUDENT") {
    if (!invitation.tenantId) {
      return NextResponse.json({ error: "Invalid student invitation" }, { status: 400 });
    }

    let newUserId: string | null = null;
    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: invitation.email,
          name,
          role: "STUDENT",
          tenantId: invitation.tenantId,
          passwordHash,
        },
      });
      newUserId = newUser.id;

      await tx.invitation.update({
        where: { token },
        data: { usedAt: new Date() },
      });
    });

    // Fan-out ACTIVE admin-seeded decks to the new student (Phase 9).
    if (newUserId) {
      addAdminDeckOnboardJob({ tenantId: invitation.tenantId!, userId: newUserId });
    }
  } else {
    return NextResponse.json({ error: "Invalid invitation role" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

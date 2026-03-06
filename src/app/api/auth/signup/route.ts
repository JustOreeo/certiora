import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { seedTenantFsrsParams } from "@/lib/fsrs";
import { hash } from "bcryptjs";
import { z } from "zod";

const signupSchema = z.object({
  tenantName: z.string().min(1, "Review center name is required"),
  tenantSlug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  adminName: z.string().min(1, "Admin name is required"),
  adminEmail: z.string().email("Valid email is required"),
});

function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const message = Object.values(first)[0]?.[0] ?? "Invalid input";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { tenantName, tenantSlug, adminName, adminEmail } = parsed.data;

    const existingSlug = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (existingSlug) {
      return NextResponse.json(
        { error: "This review center slug is already taken. Please choose another." },
        { status: 400 }
      );
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email: adminEmail },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: "This email is already registered." },
        { status: 400 }
      );
    }

    const password = generatePassword();
    const passwordHash = await hash(password, 10);

    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { slug: tenantSlug, name: tenantName },
      });
      await tx.fsrsParams.create({
        data: seedTenantFsrsParams(tenant.id),
      });
      await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          role: "ADMIN",
          tenantId: tenant.id,
          passwordHash,
        },
      });
    });

    return NextResponse.json({
      success: true,
      password,
      message: "Account created. Save your password — it will not be shown again.",
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

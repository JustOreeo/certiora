import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  logoUrl: z.string().url().optional().nullable(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g. #4B4EFC)")
    .optional()
    .nullable(),
});

/**
 * PATCH /api/[tenantSlug]/admin/branding
 * Admin only. Updates tenant logo URL and/or primary color for white-labeling.
 */
export async function PATCH(
  request: NextRequest,
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

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      ...(parsed.data.logoUrl !== undefined && { logoUrl: parsed.data.logoUrl }),
      ...(parsed.data.primaryColor !== undefined && {
        primaryColor: parsed.data.primaryColor,
      }),
    },
  });

  return NextResponse.json({
    name: updated.name,
    logoUrl: updated.logoUrl ?? null,
    primaryColor: updated.primaryColor ?? null,
  });
}

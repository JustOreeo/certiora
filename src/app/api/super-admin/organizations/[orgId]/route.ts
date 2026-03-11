import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminSession } from "@/lib/super-admin";
import { prisma } from "@/lib/db";
import { updateOrganizationSchema } from "@/lib/validations/super-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const session = await getSuperAdminSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = updateOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: params.orgId },
  });
  if (!org)
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );

  const updated = await prisma.organization.update({
    where: { id: params.orgId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const session = await getSuperAdminSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await prisma.organization.findUnique({
    where: { id: params.orgId },
  });
  if (!org)
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );

  await prisma.$transaction([
    prisma.tenant.updateMany({
      where: { organizationId: params.orgId },
      data: { organizationId: null },
    }),
    prisma.organization.delete({ where: { id: params.orgId } }),
  ]);

  return new NextResponse(null, { status: 204 });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

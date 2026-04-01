import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

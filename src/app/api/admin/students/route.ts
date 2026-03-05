import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, tenantScope } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "50");

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where: { ...tenantScope(session.tenantId), role: "STUDENT" },
      select: { id: true, email: true, name: true, credentialsExpiresAt: true, createdAt: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({
      where: { ...tenantScope(session.tenantId), role: "STUDENT" },
    }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}

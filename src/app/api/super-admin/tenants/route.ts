import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminSession } from "@/lib/super-admin";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSuperAdminSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "all";
  const organizationId = searchParams.get("organizationId") ?? "all";
  const sort = searchParams.get("sort") ?? "newest";

  const where: Prisma.TenantWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status === "active") where.isActive = true;
  else if (status === "suspended") where.isActive = false;

  if (organizationId === "standalone") where.organizationId = null;
  else if (organizationId !== "all") where.organizationId = organizationId;

  const orderByMap: Record<string, Prisma.TenantOrderByWithRelationInput> = {
    newest: { createdAt: "desc" },
    oldest: { createdAt: "asc" },
    name: { name: "asc" },
  };
  const orderBy = orderByMap[sort] ?? orderByMap.newest;

  const tenants = await prisma.tenant.findMany({
    where,
    orderBy: sort !== "students" ? orderBy : { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      isActive: true,
      suspendedAt: true,
      createdAt: true,
      organizationId: true,
      organization: { select: { id: true, name: true } },
      _count: {
        select: {
          users: { where: { role: "STUDENT" } },
          courses: true,
        },
      },
      users: {
        where: { role: "ADMIN" },
        select: { id: true, name: true, email: true },
        take: 1,
      },
      examAttempts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const result = tenants.map(({ users, examAttempts, ...rest }) => ({
    ...rest,
    admin: users[0] ?? null,
    lastActivity: examAttempts[0]?.createdAt?.toISOString() ?? null,
  }));

  if (sort === "students") {
    result.sort((a, b) => b._count.users - a._count.users);
  }

  return NextResponse.json(result);
}

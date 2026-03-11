import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminSession } from "@/lib/super-admin";
import { prisma } from "@/lib/db";
import { createOrganizationSchema } from "@/lib/validations/super-admin";

export async function GET() {
  const session = await getSuperAdminSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const organizations = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      createdAt: true,
      tenants: {
        select: {
          id: true,
          slug: true,
          name: true,
          _count: { select: { users: { where: { role: "STUDENT" } } } },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  const result = organizations.map((org) => ({
    ...org,
    tenants: org.tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      _count: { students: t._count.users },
    })),
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getSuperAdminSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = createOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const org = await prisma.organization.create({
    data: {
      name: parsed.data.name,
      logoUrl: parsed.data.logoUrl ?? null,
    },
  });

  return NextResponse.json(org, { status: 201 });
}

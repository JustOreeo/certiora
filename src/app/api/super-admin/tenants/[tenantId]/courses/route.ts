import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminSession } from "@/lib/super-admin";
import { prisma } from "@/lib/db";
import { createCourseSchema } from "@/lib/validations/super-admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const session = await getSuperAdminSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const courses = await prisma.tenantCourse.findMany({
    where: { tenantId: params.tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      targetExamDate: true,
      isActive: true,
      createdAt: true,
      _count: { select: { students: true } },
    },
  });

  return NextResponse.json(courses);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const session = await getSuperAdminSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = createCourseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
  });
  if (!tenant)
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const course = await prisma.tenantCourse.create({
    data: {
      tenantId: params.tenantId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      targetExamDate: parsed.data.targetExamDate
        ? new Date(parsed.data.targetExamDate)
        : null,
    },
  });

  return NextResponse.json(course, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminSession } from "@/lib/super-admin";
import { prisma } from "@/lib/db";
import { updateCourseSchema } from "@/lib/validations/super-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { tenantId: string; courseId: string } }
) {
  const session = await getSuperAdminSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = updateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const course = await prisma.tenantCourse.findFirst({
    where: { id: params.courseId, tenantId: params.tenantId },
  });
  if (!course)
    return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined)
    data.description = parsed.data.description;
  if (parsed.data.targetExamDate !== undefined) {
    data.targetExamDate = parsed.data.targetExamDate
      ? new Date(parsed.data.targetExamDate)
      : null;
  }
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

  const updated = await prisma.tenantCourse.update({
    where: { id: params.courseId },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { tenantId: string; courseId: string } }
) {
  const session = await getSuperAdminSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const course = await prisma.tenantCourse.findFirst({
    where: { id: params.courseId, tenantId: params.tenantId },
    include: { _count: { select: { students: true } } },
  });
  if (!course)
    return NextResponse.json({ error: "Course not found" }, { status: 404 });

  if (course._count.students > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete — ${course._count.students} students are enrolled in this course. Reassign or remove students first.`,
      },
      { status: 409 }
    );
  }

  await prisma.tenantCourse.delete({ where: { id: params.courseId } });
  return new NextResponse(null, { status: 204 });
}

import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminSession } from "@/lib/super-admin";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const session = await getSuperAdminSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const courseId = searchParams.get("courseId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "50"))
  );

  const where: Prisma.UserWhereInput = {
    tenantId: params.tenantId,
    role: "STUDENT",
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (courseId) where.courseId = courseId;

  const [students, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        studentId: true,
        createdAt: true,
        course: { select: { id: true, name: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    students,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

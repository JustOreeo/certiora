import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminSession } from "@/lib/super-admin";
import { prisma } from "@/lib/db";
import { updateTenantSchema } from "@/lib/validations/super-admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const session = await getSuperAdminSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      customDomain: true,
      isActive: true,
      suspendedAt: true,
      createdAt: true,
      settings: true,
      organizationId: true,
      organization: { select: { id: true, name: true } },
      users: {
        where: { role: "ADMIN" },
        select: { id: true, name: true, email: true },
        take: 1,
      },
      _count: {
        select: {
          users: { where: { role: "STUDENT" } },
          courses: true,
          examAttempts: true,
          questions: true,
        },
      },
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const [examsTaken, activeStudentRows, flashcardReviews, lastExam] =
    await Promise.all([
      prisma.examAttempt.count({
        where: {
          tenantId: params.tenantId,
          status: "SUBMITTED",
          submittedAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.examAttempt
        .findMany({
          where: {
            tenantId: params.tenantId,
            submittedAt: { gte: thirtyDaysAgo },
          },
          distinct: ["userId"],
          select: { userId: true },
        })
        .then((rows) => rows.length),
      prisma.flashcardReviewLog.count({
        where: {
          tenantId: params.tenantId,
          reviewedAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.examAttempt.findFirst({
        where: { tenantId: params.tenantId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

  const { users, _count, ...rest } = tenant;

  return NextResponse.json({
    ...rest,
    admin: users[0] ?? null,
    _count: {
      students: _count.users,
      courses: _count.courses,
      examAttempts: _count.examAttempts,
      questions: _count.questions,
    },
    activity30d: {
      examsTaken,
      activeStudents: activeStudentRows,
      flashcardReviews,
      lastExamAt: lastExam?.createdAt?.toISOString() ?? null,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const session = await getSuperAdminSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = updateTenantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { organizationId, isActive, ...data } = parsed.data;

  if (data.slug) {
    const slugTaken = await prisma.tenant.findFirst({
      where: { slug: data.slug, id: { not: params.tenantId } },
    });
    if (slugTaken) {
      return NextResponse.json(
        { error: "Slug already taken" },
        { status: 400 }
      );
    }
  }

  if (data.customDomain) {
    const domainTaken = await prisma.tenant.findFirst({
      where: {
        customDomain: data.customDomain,
        id: { not: params.tenantId },
      },
    });
    if (domainTaken) {
      return NextResponse.json(
        { error: "Custom domain already taken" },
        { status: 400 }
      );
    }
  }

  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 400 }
      );
    }
  }

  const updateData: Record<string, unknown> = { ...data };
  if (organizationId !== undefined) updateData.organizationId = organizationId;
  if (isActive !== undefined) {
    updateData.isActive = isActive;
    updateData.suspendedAt = isActive ? null : new Date();
  }

  const tenant = await prisma.tenant.update({
    where: { id: params.tenantId },
    data: updateData,
  });

  return NextResponse.json(tenant);
}

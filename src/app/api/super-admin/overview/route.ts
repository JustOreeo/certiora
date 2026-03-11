import { NextResponse } from "next/server";
import { getSuperAdminSession } from "@/lib/super-admin";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSuperAdminSession();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    tenantCounts,
    studentTotal,
    studentsThisMonth,
    orgCount,
    courseCounts,
    recentTenants,
    recentInvitations,
  ] = await Promise.all([
    prisma.tenant.groupBy({
      by: ["isActive"],
      _count: true,
    }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({
      where: { role: "STUDENT", createdAt: { gte: startOfMonth } },
    }),
    prisma.organization.count(),
    prisma.tenantCourse.groupBy({
      by: ["isActive"],
      _count: true,
    }),
    prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.invitation.findMany({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, email: true, createdAt: true },
    }),
  ]);

  const activeTenants =
    tenantCounts.find((t) => t.isActive === true)?._count ?? 0;
  const suspendedTenants =
    tenantCounts.find((t) => t.isActive === false)?._count ?? 0;

  const activeCourses =
    courseCounts.find((c) => c.isActive === true)?._count ?? 0;
  const totalCourses = courseCounts.reduce((sum, c) => sum + c._count, 0);

  const recentActivity = [
    ...recentTenants.map((t) => ({
      type: "TENANT_CREATED" as const,
      description: `${t.name} joined the platform`,
      timestamp: t.createdAt.toISOString(),
    })),
    ...recentInvitations.map((inv) => ({
      type: "INVITATION_SENT" as const,
      description: `Invitation sent to ${inv.email}`,
      timestamp: inv.createdAt.toISOString(),
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 20);

  return NextResponse.json({
    tenants: {
      total: activeTenants + suspendedTenants,
      active: activeTenants,
      suspended: suspendedTenants,
    },
    students: { total: studentTotal, thisMonth: studentsThisMonth },
    organizations: { total: orgCount },
    courses: { total: totalCourses, active: activeCourses },
    recentActivity,
  });
}

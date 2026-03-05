import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, tenantScope } from "@/lib/db";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || (session.role !== "ADMIN" && session.role !== "INSTRUCTOR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const updated = await prisma.question.updateMany({
      where: { id: params.id, ...tenantScope(session.tenantId), status: "DRAFT" },
      data: { status: "PENDING_APPROVAL" },
    });
    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Question not found or not in DRAFT status" },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Submit for approval error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

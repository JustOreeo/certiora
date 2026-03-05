import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { questionBankService } from "@/services/question-bank";

/**
 * GET /api/admin/questions/[id]
 * Returns a single question (admin/instructor only).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || (session.role !== "ADMIN" && session.role !== "INSTRUCTOR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const question = await questionBankService.getById(session.tenantId, id);
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
  return NextResponse.json(question);
}

/**
 * DELETE /api/admin/questions/[id]
 * Deletes a question. Blocked if the question is part of an IN_PROGRESS exam attempt.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || (session.role !== "ADMIN" && session.role !== "INSTRUCTOR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await questionBankService.delete(session.tenantId, id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("in progress")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    console.error("Delete question error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

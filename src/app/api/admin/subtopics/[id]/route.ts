import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { questionBankService } from "@/services/question-bank";
import { z } from "zod";

const updateSchema = z.object({ name: z.string().min(1) });

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || (session.role !== "ADMIN" && session.role !== "INSTRUCTOR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    await questionBankService.updateSubtopic(session.tenantId, params.id, parsed.data.name);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update subtopic error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await questionBankService.deleteSubtopic(session.tenantId, params.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("Cannot delete")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Delete subtopic error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

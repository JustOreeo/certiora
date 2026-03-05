import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { questionBankService } from "@/services/question-bank";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await questionBankService.approve(
      session.tenantId,
      params.id,
      session.user.id
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approve question error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

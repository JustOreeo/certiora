import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { questionBankService } from "@/services/question-bank";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "ADMIN" && session.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const taxonomy = await questionBankService.listTaxonomy(session.tenantId);
  return NextResponse.json(taxonomy);
}

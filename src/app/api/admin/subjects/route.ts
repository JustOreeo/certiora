import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { questionBankService } from "@/services/question-bank";
import { z } from "zod";

const createSubjectSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().default(0),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createSubjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const subject = await questionBankService.createSubject(
      session.tenantId,
      parsed.data.name,
      parsed.data.order
    );
    return NextResponse.json(subject);
  } catch (error) {
    console.error("Create subject error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

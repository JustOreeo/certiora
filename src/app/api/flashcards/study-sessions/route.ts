import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { srsService } from "@/services/srs";
import { z } from "zod";

const createSessionSchema = z.object({
  deckId: z.string().min(1).optional(),
  mode: z.enum(["NORMAL", "CRAM"]).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await srsService.startStudySession(
      session.tenantId,
      session.user.id,
      { deckId: parsed.data.deckId, mode: parsed.data.mode }
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Study session create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

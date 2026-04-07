import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { srsService } from "@/services/srs";
import { z } from "zod";

type Params = { params: Promise<{ sessionId: string }> };

const endSessionSchema = z.object({
  cardsReviewed: z.number().int().min(0),
  cardsCorrect: z.number().int().min(0),
  xpEarned: z.number().int().min(0),
  totalTimeMs: z.number().int().min(0),
});

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await params;
  const result = await srsService.getStudySession(session.tenantId, session.user.id, sessionId);
  if (!result) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = endSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await srsService.endStudySession(
      session.tenantId,
      session.user.id,
      sessionId,
      parsed.data
    );
    if (!result) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Study session end error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

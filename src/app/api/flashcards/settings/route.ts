import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";
import { isFsrsOptimizeJobQueuedOrActive } from "@/lib/queue";
import { patchSettingsSchema } from "@/types/schemas";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [settings, optimizeJobQueuedOrActive] = await Promise.all([
      flashcardService.getSettings(session.tenantId, session.user.id),
      isFsrsOptimizeJobQueuedOrActive(session.user.id),
    ]);
    return NextResponse.json({ ...settings, optimizeJobQueuedOrActive });
  } catch (error) {
    console.error("Flashcard settings GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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
  const parsed = patchSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const settings = await flashcardService.updateSettings(
      session.tenantId,
      session.user.id,
      {
        retentionTarget: parsed.data.retentionTarget,
        examDate: parsed.data.examDate,
        retentionManualOverride: parsed.data.retentionManualOverride,
      }
    );
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Flashcard settings PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

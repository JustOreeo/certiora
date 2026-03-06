import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";
import { addFsrsOptimizeJob, isFsrsOptimizeJobQueuedOrActive } from "@/lib/queue";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const settings = await flashcardService.getSettings(session.tenantId, session.user.id);
    if (settings.reviewCount < 1000) {
      return NextResponse.json(
        { error: "At least 1,000 reviews required for optimization" },
        { status: 400 }
      );
    }
    const queuedOrActive = await isFsrsOptimizeJobQueuedOrActive(session.user.id);
    if (queuedOrActive) {
      return NextResponse.json(
        { error: "Optimization job already queued or running" },
        { status: 409 }
      );
    }
    const added = await addFsrsOptimizeJob({
      userId: session.user.id,
      tenantId: session.tenantId,
    });
    if (!added) {
      return NextResponse.json(
        { error: "Optimization job already queued or running" },
        { status: 409 }
      );
    }
    return NextResponse.json({ status: "queued" });
  } catch (error) {
    console.error("Flashcard settings optimize error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { flashcardService } from "@/services/flashcard";
import Papa from "papaparse";

type Params = { params: Promise<{ deckId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { deckId } = await params;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return NextResponse.json({ error: "Failed to parse CSV" }, { status: 400 });
  }

  const cards: Array<{ front: string; back: string }> = [];
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const front = (row.front ?? row.Front ?? "").trim();
    const back = (row.back ?? row.Back ?? "").trim();
    if (!front || !back) {
      errors.push({ row: i + 1, error: "Missing front or back" });
      continue;
    }
    if (front.length > 1000) {
      errors.push({ row: i + 1, error: "Front exceeds 1000 chars" });
      continue;
    }
    if (back.length > 2000) {
      errors.push({ row: i + 1, error: "Back exceeds 2000 chars" });
      continue;
    }
    cards.push({ front, back });
  }

  if (cards.length === 0) {
    return NextResponse.json({ error: "No valid cards found in CSV", parseErrors: errors }, { status: 400 });
  }

  if (cards.length > 500) {
    return NextResponse.json({ error: "Maximum 500 cards per import" }, { status: 400 });
  }

  try {
    const result = await flashcardService.addCardsBulk(
      session.tenantId,
      session.user.id,
      deckId,
      cards
    );
    if (!result) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }
    return NextResponse.json({
      created: result.created,
      errors: [...errors, ...result.errors],
    });
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

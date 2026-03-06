"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toUserMessage } from "@/lib/errors";

type Option = { id: string; text: string; isCorrect?: boolean };
type DueCardExam = {
  cardType: "exam";
  id: string;
  questionId: string;
  question: { id: string; stem: string; options: Option[]; explanation?: string | null };
  nextReviewAt: string;
};
type DueCardCustom = {
  cardType: "custom";
  id: string;
  cardId: string;
  front: string;
  back: string;
  deckId: string;
  deckName: string;
  nextReviewAt: string;
  intervalPreview?: { grade: 1 | 2 | 3 | 4; scheduledDays: number }[];
};
type DueCard = DueCardExam | DueCardCustom;

type DeckForFilter = { id: string; name: string; dueToday: number };
type Summary = {
  dueToday: number;
  dueTomorrow: number;
  total: number;
  customDueToday?: number;
  customTotal?: number;
  byState?: Record<string, number>;
};

const GRADE_BUTTONS: { label: string; grade: 1 | 2 | 3 | 4; key: string }[] = [
  { label: "Again", grade: 1, key: "1" },
  { label: "Hard", grade: 2, key: "2" },
  { label: "Good", grade: 3, key: "3" },
  { label: "Easy", grade: 4, key: "4" },
];

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function formatInterval(days: number): string {
  if (days < 1) return "< 1 day";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function FlashcardsReviewTab({ tenantSlug }: { tenantSlug: string }) {
  const [cards, setCards] = useState<DueCard[]>([]);
  const [decks, setDecks] = useState<DeckForFilter[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [grading, setGrading] = useState(false);
  const [reviewedThisSession, setReviewedThisSession] = useState(0);
  const [deckFilter, setDeckFilter] = useState<string | null>(null);
  const [lastScheduledDays, setLastScheduledDays] = useState<number | null>(null);

  const loadDecks = useCallback(async () => {
    try {
      const res = await fetch("/api/flashcards/decks");
      if (!res.ok) return;
      const data = await res.json();
      setDecks(Array.isArray(data) ? data : []);
    } catch {
      setDecks([]);
    }
  }, []);

  const loadData = useCallback(
    async (deckId?: string | null) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("dueOnly", "true");
        if (deckId) params.set("deckId", deckId);
        const [cardsRes, summaryRes] = await Promise.all([
          fetch(`/api/srs/cards?${params.toString()}`),
          fetch(deckId ? `/api/srs/summary?deckId=${deckId}` : "/api/srs/summary"),
        ]);
        const cardsData = await cardsRes.json();
        const summaryData = await summaryRes.json();
        setCards(Array.isArray(cardsData) ? cardsData : []);
        setSummary(
          summaryData.dueToday != null
            ? {
                dueToday: summaryData.dueToday,
                dueTomorrow: summaryData.dueTomorrow,
                total: summaryData.total,
                customDueToday: summaryData.customDueToday,
                customTotal: summaryData.customTotal,
                byState: summaryData.byState,
              }
            : null
        );
      } catch (error) {
        console.error("Failed to load flashcards:", error);
        setCards([]);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  useEffect(() => {
    loadData(deckFilter ?? undefined);
  }, [deckFilter, loadData]);

  const gradeCard = async (card: DueCard, grade: 1 | 2 | 3 | 4) => {
    setGrading(true);
    setLastScheduledDays(null);
    try {
      const res = await fetch("/api/srs/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardType: card.cardType, id: card.id, grade }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(toUserMessage(data, "Failed to grade card. Please try again."));
        return;
      }
      if (data.scheduledDays != null) setLastScheduledDays(data.scheduledDays);
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      setReviewedThisSession((n) => n + 1);
      setFlipped(false);
      if (summary) {
        setSummary((s) =>
          s
            ? {
                ...s,
                dueToday: Math.max(0, s.dueToday - 1),
                total: s.total,
              }
            : null
        );
      }
    } catch (error) {
      alert(toUserMessage(error, "Failed to grade card. Please try again."));
    } finally {
      setGrading(false);
    }
  };

  const currentCard = cards[0];
  const hasCards = summary && summary.total > 0;
  const hasDueCards = cards.length > 0;
  const isExamCard = currentCard?.cardType === "exam";
  const isCustomCard = currentCard?.cardType === "custom";
  const intervalPreview =
    isCustomCard && currentCard.intervalPreview
      ? Object.fromEntries(currentCard.intervalPreview.map((p) => [p.grade, p.scheduledDays]))
      : null;

  return (
    <div className="max-w-2xl mx-auto">
      {decks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label="Filter by deck">
          <button
            type="button"
            onClick={() => setDeckFilter(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              deckFilter === null
                ? "bg-primary text-inverse"
                : "border border-border bg-surface-card text-body hover:bg-surface-base"
            }`}
          >
            All
          </button>
          {decks.map((deck) => {
            const due = deck.dueToday ?? 0;
            const selected = deckFilter === deck.id;
            return (
              <button
                key={deck.id}
                type="button"
                onClick={() => setDeckFilter(deck.id)}
                disabled={due === 0}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selected ? "bg-primary text-inverse" : due === 0 ? "opacity-50 cursor-not-allowed border border-border bg-surface-card text-secondary" : "border border-border bg-surface-card text-body hover:bg-surface-base"
                }`}
              >
                {deck.name}
                {due > 0 && (
                  <span className="ml-1.5 text-xs">
                    ({due})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {summary && (
        <p className="text-sm text-secondary mb-6">
          {cards.length} card{cards.length !== 1 ? "s" : ""} left
          {deckFilter && " in this deck"}
          {" · "}
          Reviewed this session: {reviewedThisSession}
          {summary.dueTomorrow != null && ` · Due tomorrow: ${summary.dueTomorrow}`}
          {summary.total != null && ` · Total: ${summary.total}`}
        </p>
      )}

      {!hasCards && (
        <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-secondary">
            No flashcards yet. Take exams or create custom decks to build your collection.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-4">
            <Link
              href={`/${tenantSlug}/exams`}
              className="inline-flex h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
            >
              Go to exams
            </Link>
            <Link
              href={`/${tenantSlug}/flashcards`}
              className="inline-flex h-10 items-center px-5 rounded-lg text-sm font-medium border border-border bg-surface-card hover:bg-surface-base"
            >
              My Decks
            </Link>
          </div>
        </div>
      )}

      {hasCards && !hasDueCards && (
        <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-secondary">
            You&apos;re all caught up for now.
            {summary && (
              <>
                {" "}
                {summary.dueTomorrow} due tomorrow, {summary.total} total cards.
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-4">
            <Link
              href={`/${tenantSlug}/flashcards`}
              className="inline-flex h-10 items-center px-5 rounded-lg text-sm font-medium border border-border bg-surface-card hover:bg-surface-base"
            >
              Browse My Decks
            </Link>
            <Link
              href={`/${tenantSlug}/flashcards`}
              className="inline-flex h-10 items-center px-5 rounded-lg text-sm font-medium border border-border bg-surface-card hover:bg-surface-base"
            >
              Explore Library
            </Link>
          </div>
        </div>
      )}

      {hasDueCards && currentCard && (
        <div className="space-y-6">
          {/* Deck label for custom cards (§8.3) */}
          {isCustomCard && (
            <div className="flex justify-end">
              <span className="text-xs text-secondary px-2 py-1 rounded bg-surface-base border border-border">
                {currentCard.deckName}
              </span>
            </div>
          )}

          <div
            className="bg-surface-card border-2 border-border rounded-2xl shadow-md overflow-hidden min-h-[280px] max-w-2xl w-full mx-auto"
            style={{ perspective: "1200px" }}
            role="button"
            tabIndex={0}
            onClick={() => setFlipped((f) => !f)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setFlipped((f) => !f);
              }
              if (!flipped && ["1", "2", "3", "4"].includes(e.key)) {
                e.preventDefault();
                const g = Number(e.key) as 1 | 2 | 3 | 4;
                gradeCard(currentCard, g);
              }
            }}
            aria-label={flipped ? "Hide answer" : "Reveal answer"}
          >
            <div className="px-6 py-6">
              {isExamCard && (
                <>
                  <p className="text-[14.5px] font-medium text-body leading-snug mb-4">
                    {currentCard.question.stem}
                  </p>
                  {flipped ? (
                    <div className="space-y-2">
                      {(currentCard.question.options || []).map((opt: Option) => (
                        <div
                          key={opt.id}
                          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-border bg-surface-base text-sm text-body"
                        >
                          <span className="w-4 text-center">
                            {opt.isCorrect ? (
                              <span className="text-success font-medium">✓</span>
                            ) : null}
                          </span>
                          {opt.text}
                        </div>
                      ))}
                      {currentCard.question.explanation && (
                        <div className="mt-4 bg-info-bg border border-info-border rounded-lg px-4 py-3">
                          <p className="text-xs font-semibold text-info mb-1">Explanation</p>
                          <p className="text-sm text-body">{currentCard.question.explanation}</p>
                        </div>
                      )}
                      <p className="text-xs text-muted mt-2">Tap card to hide answer</p>
                    </div>
                  ) : (
                    <p className="text-sm text-secondary">Tap to reveal options</p>
                  )}
                </>
              )}
              {isCustomCard && (
                <>
                  {!flipped ? (
                    <p className="text-body text-base leading-relaxed whitespace-pre-wrap">
                      {currentCard.front}
                    </p>
                  ) : (
                    <p className="text-body text-base leading-relaxed whitespace-pre-wrap">
                      {currentCard.back}
                    </p>
                  )}
                  <p className="text-xs text-muted mt-4">
                    {flipped ? "Tap to hide answer" : "Tap to reveal answer"}
                  </p>
                </>
              )}
            </div>
          </div>

          {flipped && (
            <div className="flex flex-wrap gap-3 justify-center">
              {GRADE_BUTTONS.map(({ label, grade, key }) => (
                <button
                  key={grade}
                  type="button"
                  disabled={grading}
                  onClick={() => gradeCard(currentCard, grade)}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-surface-card hover:bg-surface-base disabled:opacity-60 transition-colors flex flex-col items-center"
                >
                  <span>{label}</span>
                  {intervalPreview?.[grade as 1 | 2 | 3 | 4] != null && (
                    <span className="text-xs text-muted mt-0.5">
                      {formatInterval(intervalPreview[grade as 1 | 2 | 3 | 4])}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {!flipped && (
            <p className="text-center text-sm text-muted">
              Flip the card to reveal the answer, then grade with 1–4 or the buttons below.
            </p>
          )}

          {lastScheduledDays != null && (
            <p className="text-center text-sm text-success">
              Next review in {formatInterval(lastScheduledDays)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

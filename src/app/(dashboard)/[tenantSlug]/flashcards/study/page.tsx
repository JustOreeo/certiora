"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MarkdownCardContent } from "@/components/MarkdownCardContent";

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

const GRADE_BUTTONS: {
  label: string;
  grade: 1 | 2 | 3 | 4;
  key: string;
  className: string;
}[] = [
  { label: "Again", grade: 1, key: "1", className: "bg-error-bg text-error border-error-border" },
  { label: "Hard", grade: 2, key: "2", className: "bg-warning-bg text-warning border-warning-border" },
  { label: "Good", grade: 3, key: "3", className: "bg-success-bg text-success border-success-border" },
  { label: "Easy", grade: 4, key: "4", className: "bg-primary text-inverse border-primary" },
];

function formatInterval(days: number): string {
  if (days < 1) return "< 1d";
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function Spinner() {
  return (
    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function StudyPage() {
  const params = useParams<{ tenantSlug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSlug = params?.tenantSlug ?? "";
  const deckId = searchParams.get("deckId") ?? undefined;
  const mode = (searchParams.get("mode") ?? "normal") as "normal" | "cram";
  const isCram = mode === "cram";

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cards, setCards] = useState<DueCardCustom[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [grading, setGrading] = useState(false);
  const [exitingCard, setExitingCard] = useState<{
    cardId: string;
    grade: 1 | 2 | 3 | 4;
  } | null>(null);
  const [undoLogId, setUndoLogId] = useState<string | null>(null);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [undoing, setUndoing] = useState(false);

  // Stats
  const [cardsReviewed, setCardsReviewed] = useState(0);
  const [cardsCorrect, setCardsCorrect] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const startTimeRef = useRef(Date.now());
  const [sessionDone, setSessionDone] = useState(false);

  const EXIT_DURATION_MS = { 1: 300, 2: 200, 3: 200, 4: 220 } as const;

  // Create study session
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch("/api/flashcards/study-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deckId,
            mode: isCram ? "CRAM" : "NORMAL",
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setSessionId(data.sessionId);
        }
      } catch {
        // Non-critical, continue without session tracking
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load cards (batched)
  const loadCards = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ batchSize: "10" });
        if (deckId) params.set("deckId", deckId);
        if (cursor) params.set("cursor", cursor);
        if (isCram) params.set("mode", "cram");
        const res = await fetch(`/api/srs/cards?${params}`);
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        const newCards: DueCardCustom[] = data.cards ?? [];
        if (cursor) {
          setCards((prev) => [...prev, ...newCards]);
        } else {
          setCards(newCards);
        }
        setNextCursor(data.nextCursor ?? null);
      } catch (e) {
        console.error(e);
        if (!cursor) setCards([]);
      } finally {
        setLoading(false);
      }
    },
    [deckId, isCram]
  );

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Prefetch next batch when running low
  useEffect(() => {
    if (cards.length < 3 && nextCursor && !loading) {
      loadCards(nextCursor);
    }
  }, [cards.length, nextCursor, loading, loadCards]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (grading || exitingCard || sessionDone) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const grade = Number(e.key) as 1 | 2 | 3 | 4;
        const card = cards[0];
        if (card) gradeCard(card, grade);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, grading, exitingCard, sessionDone, cards]);

  const gradeCard = async (card: DueCardCustom, grade: 1 | 2 | 3 | 4) => {
    // Clear any pending undo
    if (undoTimer) clearTimeout(undoTimer);
    setUndoLogId(null);

    if (isCram) {
      // Cram mode: no API call, just advance
      setExitingCard({ cardId: card.id, grade });
      setTimeout(() => {
        setCards((prev) => prev.filter((c) => c.id !== card.id));
        setCardsReviewed((n) => n + 1);
        if (grade >= 3) {
          setCardsCorrect((n) => n + 1);
          setXpEarned((x) => x + 1);
        }
        setFlipped(false);
        setExitingCard(null);
      }, EXIT_DURATION_MS[grade]);
      return;
    }

    setGrading(true);
    try {
      const res = await fetch("/api/srs/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardType: "custom",
          id: card.id,
          grade,
          sessionId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGrading(false);
        return;
      }

      // Enable undo for 5 seconds
      if (data.reviewLogId) {
        setUndoLogId(data.reviewLogId);
        const timer = setTimeout(() => setUndoLogId(null), 5000);
        setUndoTimer(timer);
      }

      setExitingCard({ cardId: card.id, grade });
      setGrading(false);

      setTimeout(() => {
        setCards((prev) => prev.filter((c) => c.id !== card.id));
        setCardsReviewed((n) => n + 1);
        if (grade >= 3) {
          setCardsCorrect((n) => n + 1);
          setXpEarned((x) => x + 1);
        }
        setFlipped(false);
        setExitingCard(null);
      }, EXIT_DURATION_MS[grade]);
    } catch {
      setGrading(false);
    }
  };

  const handleUndo = async () => {
    if (!undoLogId || undoing) return;
    setUndoing(true);
    try {
      const res = await fetch("/api/srs/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewLogId: undoLogId }),
      });
      if (res.ok) {
        setUndoLogId(null);
        if (undoTimer) clearTimeout(undoTimer);
        // Reload cards to get the restored card back
        setCards([]);
        loadCards();
        setCardsReviewed((n) => Math.max(0, n - 1));
      }
    } catch {
      // Silently fail
    } finally {
      setUndoing(false);
    }
  };

  const handleEndSession = async () => {
    const totalTimeMs = Date.now() - startTimeRef.current;
    if (sessionId) {
      try {
        await fetch(`/api/flashcards/study-sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardsReviewed, cardsCorrect, xpEarned, totalTimeMs }),
        });
      } catch {
        // Non-critical
      }
    }
    setSessionDone(true);
  };

  // Auto-end session when no more cards
  useEffect(() => {
    if (!loading && cards.length === 0 && !nextCursor && cardsReviewed > 0 && !sessionDone) {
      handleEndSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length, loading, nextCursor]);

  const currentCard = cards[0];
  const totalInSession = cardsReviewed + cards.length;
  const progressPercent = totalInSession > 0 ? (cardsReviewed / totalInSession) * 100 : 0;
  const exitAnimationClass =
    exitingCard && currentCard && exitingCard.cardId === currentCard.id
      ? exitingCard.grade === 1
        ? "card-anim-exit-again"
        : exitingCard.grade === 4
          ? "card-anim-exit-easy"
          : "card-anim-exit-left"
      : null;
  const intervalPreview =
    currentCard?.intervalPreview
      ? Object.fromEntries(currentCard.intervalPreview.map((p) => [p.grade, p.scheduledDays]))
      : null;

  // Session summary
  if (sessionDone) {
    const totalTimeMs = Date.now() - startTimeRef.current;
    const accuracy = cardsReviewed > 0 ? Math.round((cardsCorrect / cardsReviewed) * 100) : 0;
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
        <div className="w-full max-w-md bg-surface-card border border-border rounded-2xl p-8 shadow-lg text-center space-y-6">
          <h1 className="text-2xl font-bold text-body">
            {isCram ? "Cram Session Complete" : "Study Session Complete"}
          </h1>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-base rounded-xl p-4">
              <p className="text-2xl font-bold text-body">{cardsReviewed}</p>
              <p className="text-xs text-secondary">Cards reviewed</p>
            </div>
            {!isCram && (
              <div className="bg-surface-base rounded-xl p-4">
                <p className="text-2xl font-bold text-body">{accuracy}%</p>
                <p className="text-xs text-secondary">Accuracy</p>
              </div>
            )}
            <div className="bg-surface-base rounded-xl p-4">
              <p className="text-2xl font-bold text-body">{formatTime(totalTimeMs)}</p>
              <p className="text-xs text-secondary">Time spent</p>
            </div>
            <div className="bg-surface-base rounded-xl p-4">
              <p className="text-2xl font-bold text-primary">{xpEarned}</p>
              <p className="text-xs text-secondary">XP earned</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setSessionDone(false);
                setCardsReviewed(0);
                setCardsCorrect(0);
                setXpEarned(0);
                startTimeRef.current = Date.now();
                loadCards();
              }}
              className="h-12 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
            >
              Continue studying
            </button>
            <Link
              href={`/${tenantSlug}/flashcards`}
              className="h-12 flex items-center justify-center rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card transition-colors"
            >
              Back to flashcards
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (loading && cards.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <Spinner />
      </div>
    );
  }

  // No cards at all
  if (!loading && cards.length === 0 && cardsReviewed === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
        <div className="w-full max-w-md bg-surface-card border border-border rounded-2xl p-8 shadow-lg text-center space-y-4">
          <h1 className="text-xl font-bold text-body">
            {isCram ? "No cards in this deck" : "No cards due"}
          </h1>
          <p className="text-sm text-secondary">
            {isCram
              ? "This deck has no cards yet."
              : "You're all caught up! Come back later when more cards are due."}
          </p>
          <Link
            href={`/${tenantSlug}/flashcards`}
            className="inline-flex h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover"
          >
            Back to flashcards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto w-full">
        <Link
          href={`/${tenantSlug}/flashcards`}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-surface-card text-body hover:bg-surface-base"
          aria-label="Exit study"
        >
          <span className="text-lg leading-none">&times;</span>
        </Link>
        <div className="flex-1 min-w-0 h-2.5 rounded-full bg-surface-card border border-border overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
        {xpEarned > 0 && (
          <span className="shrink-0 text-xs font-bold rounded-full px-2 py-0.5 bg-primary text-inverse">
            +{xpEarned}
          </span>
        )}
        {isCram && (
          <span className="shrink-0 text-xs font-medium rounded-full px-2 py-0.5 bg-warning-bg text-warning border border-warning-border">
            Cram
          </span>
        )}
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-4 pb-4">
        {currentCard && (
          <div
            className={`w-full max-w-lg ${exitAnimationClass ?? ""}`}
            style={{ perspective: "1000px" }}
          >
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="w-full text-left focus:outline-none"
              aria-label={flipped ? "Show front" : "Show back"}
            >
              <div
                className="relative w-full min-h-[280px] sm:min-h-[320px]"
                style={{
                  transformStyle: "preserve-3d",
                  transition: "transform 450ms cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* Front */}
                <div
                  className="absolute inset-0 bg-surface-card border border-border rounded-2xl p-6 sm:p-8 shadow-lg flex flex-col justify-center"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <p className="text-xs text-secondary mb-3">{currentCard.deckName}</p>
                  <div className="text-lg font-medium text-body">
                    <MarkdownCardContent content={currentCard.front} format="markdown" />
                  </div>
                  <p className="text-xs text-muted mt-4">Tap to flip</p>
                </div>

                {/* Back */}
                <div
                  className="absolute inset-0 bg-surface-card border border-border rounded-2xl p-6 sm:p-8 shadow-lg flex flex-col justify-center"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <p className="text-xs text-secondary mb-3">Answer</p>
                  <div className="text-base text-body">
                    <MarkdownCardContent content={currentCard.back} format="markdown" />
                  </div>
                </div>
              </div>
            </button>

            {/* Grade buttons */}
            {flipped && (
              <div className="mt-6 grid grid-cols-4 gap-2">
                {GRADE_BUTTONS.map((btn) => (
                  <button
                    key={btn.grade}
                    type="button"
                    disabled={grading}
                    onClick={() => gradeCard(currentCard, btn.grade)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 ${btn.className}`}
                  >
                    <span className="text-sm">{btn.label}</span>
                    {!isCram && intervalPreview && intervalPreview[btn.grade] != null && (
                      <span className="text-[10px] opacity-75">
                        {formatInterval(intervalPreview[btn.grade])}
                      </span>
                    )}
                    <span className="text-[10px] opacity-50">{btn.key}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Undo toast */}
      {undoLogId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoing}
            className="px-4 py-2 rounded-lg bg-surface-card border border-border text-sm font-medium text-body shadow-lg hover:bg-surface-base disabled:opacity-50 transition-colors"
          >
            {undoing ? "Undoing…" : "Undo last grade"}
          </button>
        </div>
      )}
    </div>
  );
}

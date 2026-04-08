"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MarkdownCardContent } from "@/components/MarkdownCardContent";
import { Spinner } from "@/components/ui/Spinner";
import { QuestionCircleIcon, LightbulbIcon, CelebrationIcon, EmptyBoxIcon, HintIcon, CheckCircleIcon } from "@/components/ui/Icons";
import { GRADE_BUTTONS, GradeIcon, formatIntervalShort } from "../_components/flashcard-constants";
import { useCountUp } from "@/hooks/useCountUp";
import confetti from "canvas-confetti";

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

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

/* ── Session summary stat with count-up ──────────────────────────────── */
function SummaryStat({
  value,
  label,
  color = "text-body",
  delay = 0,
  suffix = "",
}: {
  value: number;
  label: string;
  color?: string;
  delay?: number;
  suffix?: string;
}) {
  const displayed = useCountUp(value, 800);
  return (
    <div
      className="bg-surface-base rounded-xl p-5 anim-stagger"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className={`text-3xl font-bold ${color}`}>
        {suffix === "%" ? `${displayed}%` : displayed}
      </p>
      <p className="text-xs text-secondary mt-1">{label}</p>
    </div>
  );
}

function SummaryStatTime({
  ms,
  label,
  delay = 0,
}: {
  ms: number;
  label: string;
  delay?: number;
}) {
  return (
    <div
      className="bg-surface-base rounded-xl p-5 anim-stagger"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-3xl font-bold text-body">{formatTime(ms)}</p>
      <p className="text-xs text-secondary mt-1">{label}</p>
    </div>
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
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [hasFlippedOnce, setHasFlippedOnce] = useState(false);

  // Stats
  const [cardsReviewed, setCardsReviewed] = useState(0);
  const [cardsCorrect, setCardsCorrect] = useState(0);
  const startTimeRef = useRef(Date.now());
  const [sessionDone, setSessionDone] = useState(false);
  const [deckName, setDeckName] = useState<string | null>(null);
  const [progressPulse, setProgressPulse] = useState(false);
  // Track card entrance key for animation re-trigger
  const [cardKey, setCardKey] = useState(0);

  const EXIT_DURATION_MS = { 1: 400, 2: 220, 3: 250, 4: 280 } as const;

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
      setLoadError(null);
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
        if (!cursor && newCards.length > 0 && !deckName) {
          setDeckName(newCards[0].deckName);
        }
      } catch (e) {
        console.error(e);
        if (!cursor) {
          setCards([]);
          setLoadError("Failed to load cards. Check your connection and try again.");
        }
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
        if (!hasFlippedOnce) setHasFlippedOnce(true);
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
  }, [flipped, grading, exitingCard, sessionDone, cards, hasFlippedOnce]);

  const pulseProgress = () => {
    setProgressPulse(true);
    setTimeout(() => setProgressPulse(false), 200);
  };

  const gradeCard = async (card: DueCardCustom, grade: 1 | 2 | 3 | 4) => {
    // Clear any pending undo
    if (undoTimer) clearTimeout(undoTimer);
    setUndoLogId(null);

    if (isCram) {
      setExitingCard({ cardId: card.id, grade });
      setTimeout(() => {
        setCards((prev) => prev.filter((c) => c.id !== card.id));
        setCardsReviewed((n) => n + 1);
        if (grade >= 3) {
          setCardsCorrect((n) => n + 1);
        }
        pulseProgress();
        setFlipped(false);
        setExitingCard(null);
        setCardKey((k) => k + 1);
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
        }
        pulseProgress();
        setFlipped(false);
        setExitingCard(null);
        setCardKey((k) => k + 1);
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
          body: JSON.stringify({ cardsReviewed, cardsCorrect, totalTimeMs }),
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

  // Fire confetti on session complete (if good performance)
  useEffect(() => {
    if (!sessionDone) return;
    const accuracy = cardsReviewed > 0 ? cardsCorrect / cardsReviewed : 0;
    if (accuracy >= 0.8 && cardsReviewed >= 5) {
      const duration = 1500;
      const end = Date.now() + duration;
      const colors = ["#4B4EFC", "#676AFF", "#16A34A", "#EAB308"];
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors,
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [sessionDone, cardsReviewed, cardsCorrect]);

  const currentCard = cards[0];
  const totalInSession = cardsReviewed + cards.length;
  const progressPercent = totalInSession > 0 ? (cardsReviewed / totalInSession) * 100 : 0;
  const exitAnimationClass =
    exitingCard && currentCard && exitingCard.cardId === currentCard.id
      ? exitingCard.grade === 1
        ? "card-anim-exit-again"
        : exitingCard.grade === 4
          ? "card-anim-exit-easy"
          : exitingCard.grade === 3
            ? "card-anim-exit-good"
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
    const accuracyColor = accuracy >= 90 ? "text-success" : accuracy >= 70 ? "text-warning" : "text-error";
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E8EAF6]/40 p-4">
        <div className="w-full max-w-md bg-white border border-border rounded-2xl p-8 shadow-xl text-center space-y-6">
          {/* Animated checkmark */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center anim-bounce-in">
              <CheckCircleIcon className="w-8 h-8 text-success" />
            </div>
          </div>

          <h1
            className="text-2xl font-bold text-body anim-stagger"
            style={{ animationDelay: "150ms" }}
          >
            {isCram ? "Cram Session Complete" : "Study Session Complete"}
          </h1>
          {deckName && (
            <p className="text-sm text-secondary -mt-3">{deckName}</p>
          )}

          <div className={`grid ${isCram ? "grid-cols-2" : "grid-cols-3"} gap-3`}>
            <SummaryStat value={cardsReviewed} label="Cards reviewed" delay={250} />
            {!isCram && (
              <SummaryStat value={accuracy} label="Accuracy" color={accuracyColor} delay={350} suffix="%" />
            )}
            <SummaryStatTime ms={totalTimeMs} label="Time spent" delay={450} />
          </div>

          <div
            className="flex flex-col gap-3 pt-2 anim-stagger"
            style={{ animationDelay: "650ms" }}
          >
            {isCram ? (
              <button
                type="button"
                onClick={() => {
                  setSessionDone(false);
                  setCardsReviewed(0);
                  setCardsCorrect(0);
                  startTimeRef.current = Date.now();
                  loadCards();
                }}
                className="h-12 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-[#7C3AED] hover:shadow-lg transition-all"
              >
                Cram again
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSessionDone(false);
                  setCardsReviewed(0);
                  setCardsCorrect(0);
                  startTimeRef.current = Date.now();
                  loadCards();
                }}
                className="h-12 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-[#7C3AED] hover:shadow-lg transition-all"
              >
                Start new session
              </button>
            )}
            <Link
              href={`/${tenantSlug}/flashcards`}
              className="h-12 flex items-center justify-center rounded-xl text-sm font-medium border border-border bg-surface-base hover:bg-surface-card transition-colors"
            >
              Back to flashcards
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading — skeleton instead of spinner
  if (loading && cards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-[#E8EAF6]/40">
        <div className="flex flex-col items-center gap-3 px-4 pt-6 pb-2 max-w-4xl mx-auto w-full">
          <div className="h-8 w-32 bg-white/60 rounded-full animate-pulse" />
          <div className="w-full h-2.5 bg-white/60 rounded-full animate-pulse" />
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-4xl">
            <div className="min-h-[400px] rounded-3xl bg-white/40 animate-pulse border border-border/30" />
            <div className="mt-5 grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-white/40 animate-pulse border border-border/30" />
              ))}
            </div>
            <div className="mt-4 flex justify-center">
              <div className="h-11 w-40 rounded-xl bg-white/40 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (!loading && loadError && cards.length === 0 && cardsReviewed === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E8EAF6]/40 p-4">
        <div className="w-full max-w-md bg-white border border-border rounded-2xl p-8 shadow-lg text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-error-bg flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-error">
                <path d="M12 9v4m0 4h.01M12 2L2 20h20L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <h1 className="text-lg font-bold text-body">Something went wrong</h1>
          <p className="text-sm text-secondary">{loadError}</p>
          <button
            type="button"
            onClick={() => { setLoadError(null); loadCards(); }}
            className="inline-flex h-10 items-center px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-[#7C3AED] hover:shadow-lg transition-all"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // No cards at all
  if (!loading && cards.length === 0 && cardsReviewed === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E8EAF6]/40 p-4">
        <div className="w-full max-w-md bg-white border border-border rounded-2xl p-8 shadow-lg text-center space-y-4">
          <div className="flex justify-center anim-bounce-in">
            {isCram
              ? <EmptyBoxIcon className="w-14 h-14 text-secondary" />
              : <CelebrationIcon className="w-14 h-14 text-primary" />
            }
          </div>
          <h1 className="text-xl font-bold text-body">
            {isCram ? "No cards in this deck" : "You're all caught up!"}
          </h1>
          <p className="text-sm text-secondary">
            {isCram
              ? "This deck has no cards yet."
              : "Great job! Come back later when more cards are due."}
          </p>
          <Link
            href={`/${tenantSlug}/flashcards`}
            className="inline-flex h-10 items-center px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-[#7C3AED] hover:shadow-lg transition-all"
          >
            Back to flashcards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#E8EAF6]/40 relative overflow-hidden">
      {/* Atmospheric background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 30%, rgba(75, 78, 252, 0.06) 0%, transparent 70%)",
        }}
      />

      {/* Top section: card counter + progress */}
      <div className="relative z-10 flex flex-col items-center gap-3 px-4 pt-6 pb-2 max-w-4xl mx-auto w-full">
        {/* Exit controls — top left */}
        <div className="absolute left-4 top-6 flex items-center gap-2">
          <Link
            href={`/${tenantSlug}/flashcards`}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-border bg-white text-body hover:bg-surface-base transition-colors shadow-sm cursor-pointer"
            aria-label="Exit study"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={handleEndSession}
            className="h-9 px-4 rounded-full border border-border bg-white text-sm font-medium text-body hover:bg-surface-base transition-colors shadow-sm cursor-pointer"
          >
            End Session
          </button>
        </div>

        {/* Deck name */}
        {currentCard?.deckName && (
          <h1 className="text-sm font-semibold text-body truncate max-w-xs">
            {currentCard.deckName}
          </h1>
        )}

        {/* Card counter pill */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-white border border-border text-sm font-medium text-body shadow-sm">
            Card {cardsReviewed + 1} of {totalInSession}
          </span>
          {isCram && (
            <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-warning-bg text-warning border border-warning-border">
              Cram
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-4xl">
          <div
            className="h-2.5 rounded-full bg-white/70 border border-border/50 overflow-hidden shadow-inner"
            role="progressbar"
            aria-valuenow={Math.round(progressPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Study progress"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out relative bg-gradient-to-r from-primary to-[#7C3AED] ${progressPulse ? "animate-pulse" : ""}`}
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            >
              <div className="absolute inset-0 anim-shimmer rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Card area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-6">
        {currentCard && (
          <div
            key={cardKey}
            className={`w-full max-w-4xl card-anim-entrance ${exitAnimationClass ?? ""}`}
          >
            {/* 3D flip container */}
            <div
              className="cursor-pointer"
              style={{ perspective: "1200px" }}
              onClick={() => {
                setFlipped((f) => !f);
                if (!hasFlippedOnce) setHasFlippedOnce(true);
              }}
            >
              <div
                className="relative w-full min-h-[340px] sm:min-h-[400px]"
                style={{
                  transformStyle: "preserve-3d",
                  transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                  transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* Front face — Question (blue gradient) */}
                <div
                  className="absolute inset-0 rounded-3xl p-5 sm:p-8 shadow-xl border bg-gradient-to-br from-blue-50/80 to-indigo-50/60 border-blue-200/60 flex flex-col"
                  style={{ backfaceVisibility: "hidden" }}
                  aria-hidden={flipped}
                >
                  <div className="flex flex-col items-center gap-1 mb-5">
                    <QuestionCircleIcon className="w-7 h-7 text-indigo-500 mb-1" />
                    <h2 className="text-xl font-bold text-indigo-900">Question</h2>
                  </div>
                  <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-2xl p-5 sm:p-7 flex items-center shadow-sm border border-white/60">
                    <div className="w-full text-base sm:text-lg text-body leading-relaxed">
                      <MarkdownCardContent content={currentCard.front} format="markdown" />
                    </div>
                  </div>
                  <p className="text-center text-sm mt-4 text-indigo-700/70">
                    Click to reveal answer
                  </p>
                </div>

                {/* Back face — Answer (green gradient) */}
                <div
                  className="absolute inset-0 rounded-3xl p-5 sm:p-8 shadow-xl border bg-gradient-to-br from-green-50 to-emerald-50/80 border-green-200/60 flex flex-col"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  aria-hidden={!flipped}
                >
                  <div className="flex flex-col items-center gap-1 mb-5">
                    <LightbulbIcon className="w-7 h-7 text-green-600 mb-1" />
                    <h2 className="text-xl font-bold text-green-900">Answer</h2>
                  </div>
                  <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-2xl p-5 sm:p-7 flex items-center shadow-sm border border-white/60">
                    <div className="w-full text-base sm:text-lg text-body leading-relaxed">
                      <MarkdownCardContent content={currentCard.back} format="markdown" />
                    </div>
                  </div>
                  <p className="text-center text-sm mt-4 text-green-700/70">
                    Rate your recall
                  </p>
                </div>
              </div>
            </div>

            {/* Screen reader announcement for flip */}
            <div className="sr-only" aria-live="polite">
              {flipped ? `Answer: ${currentCard.back}` : `Question: ${currentCard.front}`}
            </div>

            {/* Grade buttons — always rendered to reserve space, hidden when not flipped */}
            <div
              className={`mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 transition-opacity duration-300 ${
                flipped ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {GRADE_BUTTONS.map((btn) => (
                <button
                  key={btn.grade}
                  type="button"
                  disabled={grading || !flipped}
                  onClick={() => gradeCard(currentCard, btn.grade)}
                  aria-label={`${btn.label} (${btn.key})${!isCram && intervalPreview && intervalPreview[btn.grade] != null ? ` — next review in ${formatIntervalShort(intervalPreview[btn.grade])}` : ""}`}
                  className={`flex items-center gap-2 justify-center min-h-[48px] py-3 px-3 rounded-xl border-2 bg-surface-card font-medium transition-all duration-150 cursor-pointer hover:scale-[1.03] active:scale-95 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shadow-sm ${btn.border} ${btn.hover}`}
                >
                  <GradeIcon grade={btn.grade} className="w-5 h-5 shrink-0" />
                  <span className="text-sm text-body">
                    <span className="font-semibold">{btn.key}</span>
                    <span> - {btn.label}</span>
                  </span>
                  {!isCram && intervalPreview && intervalPreview[btn.grade] != null && (
                    <span className="text-xs text-secondary font-mono tabular-nums ml-auto">
                      {formatIntervalShort(intervalPreview[btn.grade])}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Show Answer / Show Question button */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setFlipped((f) => !f);
                  if (!hasFlippedOnce) setHasFlippedOnce(true);
                }}
                className="h-11 px-8 rounded-xl text-sm font-semibold text-white shadow-lg transition-all duration-150 hover:scale-[1.03] active:scale-95 bg-gradient-to-r from-primary to-[#7C3AED] hover:shadow-xl"
              >
                {flipped ? "Show Question" : "Show Answer"}
              </button>
            </div>

            {/* Keyboard hint */}
            <p className="text-center text-xs text-muted mt-3">
              <HintIcon className="w-3.5 h-3.5 inline text-muted opacity-60" />{" "}
              <kbd className="px-1.5 py-0.5 bg-white/60 rounded text-[11px] font-mono border border-border/50">Space</kbd>{" "}
              to flip
              {flipped && (
                <>
                  {" · "}
                  <kbd className="px-1.5 py-0.5 bg-white/60 rounded text-[11px] font-mono border border-border/50">1</kbd>
                  –
                  <kbd className="px-1.5 py-0.5 bg-white/60 rounded text-[11px] font-mono border border-border/50">4</kbd>{" "}
                  to rate
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Undo toast */}
      {undoLogId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 anim-stagger">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoing}
            className="px-5 py-2.5 rounded-xl bg-white border border-border text-sm font-medium text-body shadow-xl hover:bg-surface-base disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-secondary">
              <path d="M3 8h10M3 8l3-3M3 8l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {undoing ? "Undoing..." : "Undo"}
          </button>
        </div>
      )}
    </div>
  );
}

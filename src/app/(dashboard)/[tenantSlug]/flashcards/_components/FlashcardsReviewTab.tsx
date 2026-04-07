"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toUserMessage } from "@/lib/errors";
import { MarkdownCardContent } from "@/components/MarkdownCardContent";

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

export function FlashcardsReviewTab({
  tenantSlug,
  onNavigateToDecks,
  onNavigateToLibrary,
}: {
  tenantSlug: string;
  onNavigateToDecks?: () => void;
  onNavigateToLibrary?: () => void;
}) {
  const [cards, setCards] = useState<DueCard[]>([]);
  const [decks, setDecks] = useState<DeckForFilter[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [grading, setGrading] = useState(false);
  const [reviewedThisSession, setReviewedThisSession] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionCompleteDismissed, setSessionCompleteDismissed] = useState(false);
  const [exitingCard, setExitingCard] = useState<{ cardId: string; grade: 1 | 2 | 3 | 4 } | null>(null);
  const [deckFilter, setDeckFilter] = useState<string | null>(null);
  const [lastScheduledDays, setLastScheduledDays] = useState<number | null>(null);

  const loadDecks = useCallback(async () => {
    try {
      const res = await fetch("/api/flashcards/decks?pageSize=100");
      if (!res.ok) return;
      const data = await res.json();
      setDecks(data.items ?? (Array.isArray(data) ? data : []));
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

  useEffect(() => {
    if (cards.length > 0) setSessionCompleteDismissed(false);
  }, [deckFilter]);

  const EXIT_DURATION_MS = { 1: 300, 2: 200, 3: 200, 4: 220 } as const;

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
      setExitingCard({ cardId: card.id, grade });
      setGrading(false);

      const duration = EXIT_DURATION_MS[grade];
      setTimeout(() => {
        setCards((prev) => prev.filter((c) => c.id !== card.id));
        setReviewedThisSession((n) => n + 1);
        if (grade >= 3) setSessionXp((x) => x + 1);
        setFlipped(false);
        setExitingCard(null);
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
      }, duration);
    } catch (error) {
      alert(toUserMessage(error, "Failed to grade card. Please try again."));
      setGrading(false);
    }
  };

  const currentCard = cards[0];
  const hasCards = summary && summary.total > 0;
  const hasDueCards = cards.length > 0;
  const decksWithDue = decks.filter((d) => (d.dueToday ?? 0) > 0).length;
  const showOriginFilter = decksWithDue >= 2; // §14: no filter UI when only one deck with due
  const isExamCard = currentCard?.cardType === "exam";
  const isCustomCard = currentCard?.cardType === "custom";
  const intervalPreview =
    isCustomCard && currentCard.intervalPreview
      ? Object.fromEntries(currentCard.intervalPreview.map((p) => [p.grade, p.scheduledDays]))
      : null;

  const totalInSession = reviewedThisSession + cards.length;
  const progressPercent = totalInSession > 0 ? (reviewedThisSession / totalInSession) * 100 : 0;
  const showSessionComplete =
    !hasDueCards && reviewedThisSession > 0 && !sessionCompleteDismissed;
  const showReviewChrome = hasDueCards || showSessionComplete;
  const showAllCaughtUp =
    hasCards && !hasDueCards && (reviewedThisSession === 0 || sessionCompleteDismissed);

  const exitAnimationClass =
    exitingCard && currentCard && exitingCard.cardId === currentCard.id
      ? exitingCard.grade === 1
        ? "card-anim-exit-again"
        : exitingCard.grade === 4
          ? "card-anim-exit-easy"
          : "card-anim-exit-left"
      : null;

  return (
    <div className="max-w-2xl mx-auto min-h-[60vh]">
      {showReviewChrome && (
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={`/${tenantSlug}/flashcards`}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-surface-card text-body hover:bg-surface-base transition-colors"
            aria-label="Exit review"
          >
            <span className="text-lg leading-none">×</span>
          </Link>
          <div className="flex-1 min-w-0 h-2.5 rounded-full bg-surface-card border border-border overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{
                width: `${Math.min(100, progressPercent)}%`,
              }}
            />
          </div>
          {sessionXp > 0 && (
            <span className="shrink-0 text-xs font-bold rounded-full px-2 py-0.5 bg-primary text-inverse">
              +{sessionXp}
            </span>
          )}
        </div>
      )}

      {showOriginFilter && (
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

      {summary && !showSessionComplete && !showAllCaughtUp && (
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

      {showSessionComplete && (
        <div className="bg-surface-card border border-border rounded-2xl px-6 py-10 text-center shadow-md">
          <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-success" aria-hidden>✓</span>
          </div>
          <h2 className="text-xl font-bold text-body mb-1">Session complete</h2>
          <p className="text-sm text-secondary mb-6">Nice work — see you tomorrow!</p>
          <div className="flex flex-wrap gap-4 justify-center mb-6">
            <div className="bg-surface-base border border-border rounded-xl px-4 py-3 min-w-[100px]">
              <p className="text-lg font-semibold text-body">{reviewedThisSession}</p>
              <p className="text-xs text-muted">Cards</p>
            </div>
            <div className="bg-surface-base border border-border rounded-xl px-4 py-3 min-w-[100px]">
              <p className="text-lg font-semibold text-primary">+{sessionXp}</p>
              <p className="text-xs text-muted">XP</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSessionCompleteDismissed(true)}
            className="h-11 px-6 rounded-xl text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
          >
            Continue
          </button>
        </div>
      )}

      {showAllCaughtUp && (
        <div className="bg-surface-base rounded-2xl px-6 py-12 text-center">
          <div className="w-[140px] h-[140px] mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="text-5xl" aria-hidden>🎉</span>
          </div>
          <h2 className="text-xl font-bold text-body mb-2">You&apos;re all caught up!</h2>
          <p className="text-sm text-secondary mb-6 max-w-sm mx-auto">
            No cards due right now. Come back later or explore your decks to add more cards.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {onNavigateToDecks ? (
              <button
                type="button"
                onClick={onNavigateToDecks}
                className="inline-flex h-10 items-center px-5 rounded-xl text-sm font-medium border border-border bg-surface-card hover:bg-surface-base transition-colors"
              >
                Browse My Decks
              </button>
            ) : (
              <Link
                href={`/${tenantSlug}/flashcards`}
                className="inline-flex h-10 items-center px-5 rounded-xl text-sm font-medium border border-border bg-surface-card hover:bg-surface-base transition-colors"
              >
                Browse My Decks
              </Link>
            )}
            {onNavigateToLibrary ? (
              <button
                type="button"
                onClick={onNavigateToLibrary}
                className="inline-flex h-10 items-center px-5 rounded-xl text-sm font-medium border border-border bg-surface-card hover:bg-surface-base transition-colors"
              >
                Explore Library
              </button>
            ) : (
              <Link
                href={`/${tenantSlug}/flashcards`}
                className="inline-flex h-10 items-center px-5 rounded-xl text-sm font-medium border border-border bg-surface-card hover:bg-surface-base transition-colors"
              >
                Explore Library
              </Link>
            )}
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
            key={currentCard.id}
            className={
              exitAnimationClass
                ? `${exitAnimationClass} bg-surface-card border-2 border-border rounded-2xl shadow-md overflow-hidden min-h-[280px] max-w-2xl w-full mx-auto relative`
                : "card-anim-entrance bg-surface-card border-2 border-border rounded-2xl shadow-md overflow-hidden min-h-[280px] max-w-2xl w-full mx-auto relative"
            }
            style={{ perspective: "1200px" }}
            role="button"
            tabIndex={0}
            onClick={() => setFlipped((f) => !f)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setFlipped((f) => !f);
              }
              if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
                e.preventDefault();
                gradeCard(currentCard, Number(e.key) as 1 | 2 | 3 | 4);
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
                <div
                  className="relative min-h-[200px] [transform-style:preserve-3d] motion-reduce:transition-none"
                  style={{
                    transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    transition: "transform 450ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <div
                    className="[backface-visibility:hidden]"
                    style={{ minHeight: "inherit" }}
                    aria-hidden={flipped}
                  >
                    <div className="text-body text-lg font-semibold text-center leading-relaxed">
                      <MarkdownCardContent content={currentCard.front} format="markdown" />
                    </div>
                    <p className="text-xs text-muted mt-4 text-center">
                      Tap to reveal answer
                    </p>
                  </div>
                  <div
                    className="absolute inset-0 [backface-visibility:hidden]"
                    style={{
                      transform: "rotateY(180deg)",
                      minHeight: "inherit",
                    }}
                    aria-hidden={!flipped}
                  >
                    <div className="text-body text-base leading-relaxed text-left">
                      <MarkdownCardContent content={currentCard.back} format="markdown" />
                    </div>
                    <p className="text-xs text-muted mt-4">Tap to hide answer</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {flipped && (
            <div className="flex flex-wrap gap-3 justify-center">
              {GRADE_BUTTONS.map(({ label, grade, key, className }) => (
                <button
                  key={grade}
                  type="button"
                  disabled={grading || !!exitingCard}
                  onClick={() => gradeCard(currentCard, grade)}
                  className={`min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold border flex flex-col items-center transition-transform hover:scale-[1.03] active:scale-[0.97] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${className}`}
                  aria-label={`${label} (${key})`}
                >
                  <span>{label}</span>
                  {intervalPreview?.[grade as 1 | 2 | 3 | 4] != null && (
                    <span className="text-xs opacity-80 mt-0.5">
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

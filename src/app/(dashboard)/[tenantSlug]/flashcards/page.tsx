"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Option = { id: string; text: string; isCorrect?: boolean };
type Question = {
  id: string;
  stem: string;
  options: Option[];
  explanation?: string | null;
};
type SrsCard = {
  id: string;
  questionId: string;
  question: Question;
  nextReviewAt: string;
};
type Summary = { dueToday: number; dueTomorrow: number; total: number };

const QUALITY_BUTTONS = [
  { label: "Again", quality: 0 },
  { label: "Hard", quality: 1 },
  { label: "Good", quality: 3 },
  { label: "Easy", quality: 5 },
];

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function FlashcardsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params?.tenantSlug ?? "";

  const [cards, setCards] = useState<SrsCard[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [grading, setGrading] = useState(false);
  const [reviewedThisSession, setReviewedThisSession] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      loadData();
    }
  }, [status, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cardsRes, summaryRes] = await Promise.all([
        fetch("/api/srs/cards?dueOnly=true"),
        fetch("/api/srs/summary"),
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
  };

  const gradeCard = async (questionId: string, quality: number) => {
    setGrading(true);
    try {
      const res = await fetch("/api/srs/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, quality }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to grade card");
        return;
      }
      setCards((prev) => prev.filter((c) => c.questionId !== questionId));
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
      console.error("Grade error:", error);
      alert("Failed to grade card");
    } finally {
      setGrading(false);
    }
  };

  const currentCard = cards[0];
  const hasCards = summary && summary.total > 0;
  const hasDueCards = cards.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="px-8 py-8 max-w-2xl mx-auto">
        {summary && (
          <p className="text-sm text-secondary mb-6">
            Reviewed this session: {reviewedThisSession}
            {summary.dueTomorrow != null && ` · Due tomorrow: ${summary.dueTomorrow}`}
            {summary.total != null && ` · Total cards: ${summary.total}`}
          </p>
        )}

        {!hasCards && (
          <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center shadow-sm">
            <p className="text-sm text-secondary">
              No flashcards yet. Take exams and get some wrong to build your deck.
            </p>
            <Link
              href={`/${tenantSlug}/exams`}
              className="inline-flex mt-4 h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
            >
              Go to exams
            </Link>
          </div>
        )}

        {hasCards && !hasDueCards && (
          <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center shadow-sm">
            <p className="text-sm text-secondary">
              All caught up for today.
              {summary && (
                <>
                  {" "}
                  {summary.dueTomorrow} due tomorrow, {summary.total} total cards.
                </>
              )}
            </p>
          </div>
        )}

        {hasDueCards && currentCard && (
          <div className="space-y-6">
            <div
              className="bg-surface-card border-2 border-border rounded-xl shadow-sm overflow-hidden"
              role="button"
              tabIndex={0}
              onClick={() => setFlipped((f) => !f)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFlipped((f) => !f);
                }
              }}
              aria-label={flipped ? "Hide answer" : "Reveal answer"}
            >
              <div className="px-6 py-6">
                <p className="text-[14.5px] font-medium text-body leading-snug mb-4">
                  {currentCard.question.stem}
                </p>
                {flipped ? (
                  <div className="space-y-2">
                    {currentCard.question.options.map((opt) => (
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
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {QUALITY_BUTTONS.map(({ label, quality }) => (
                <button
                  key={quality}
                  type="button"
                  disabled={grading}
                  onClick={() => gradeCard(currentCard.questionId, quality)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-surface-card hover:bg-surface-base disabled:opacity-60 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-muted">
              {cards.length} card{cards.length !== 1 ? "s" : ""} left in this session
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

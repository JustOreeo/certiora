"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Option = { id: string; text: string; isCorrect: boolean };
type Question = {
  id: string;
  stem: string;
  options: Option[];
  explanation?: string;
};
type Answer = {
  id: string;
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  order: number;
  question: Question;
};
type Attempt = {
  id: string;
  examType: string;
  questionCount: number;
  score: number;
  status: string;
  submittedAt: string;
  timeSpentSeconds: number | null;
  answers: Answer[];
};

function formatTimeSpent(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min > 0 ? `${h}h ${min}m` : `${h}h`;
  }
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function ReviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string; id: string }>();
  const tenantSlug = params.tenantSlug ?? "";
  const attemptId = params.id as string;

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && attemptId) {
      loadAttempt();
    }
  }, [status, router, attemptId]);

  const loadAttempt = async () => {
    try {
      const res = await fetch(`/api/exams/attempts/${attemptId}`);
      const data = await res.json();
      if (res.ok && data.status === "SUBMITTED") {
        setAttempt(data);
      } else {
        alert("Attempt not found or not submitted");
        router.push(`/${tenantSlug}/exams`);
      }
    } catch (error) {
      console.error("Failed to load attempt:", error);
      router.push(`/${tenantSlug}/exams`);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !attempt) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const correctCount = attempt.answers.filter((a) => a.isCorrect).length;
  const passed = attempt.score >= 70;

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="min-h-[56px] bg-surface-card border-b border-border px-4 sm:px-6 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-heading">Exam Review</span>
        <Link
          href={`/${tenantSlug}/exams`}
          className="min-h-[44px] flex items-center py-2 px-2 -my-1 text-sm font-medium text-link hover:text-link transition-colors rounded-lg hover:bg-surface-hover"
        >
          ← Back to exams
        </Link>
      </header>

      <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8">
        {/* Score card */}
        <div className="bg-surface-card border border-border rounded-xl shadow-sm px-6 py-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-[22px] font-semibold text-heading mb-1">
                {attempt.examType.replace("_", " ")}
              </h1>
              <p className="text-sm text-secondary">
                Submitted {new Date(attempt.submittedAt).toLocaleString()}
              </p>
              {attempt.timeSpentSeconds != null && (
                <p className="text-sm text-secondary mt-0.5">
                  Completed in {formatTimeSpent(attempt.timeSpentSeconds)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className={`text-4xl font-bold ${passed ? "text-success" : "text-error"}`}>
                {attempt.score.toFixed(1)}%
              </p>
              <p className="text-xs text-secondary mt-1">
                {correctCount} / {attempt.questionCount} correct
              </p>
            </div>
          </div>
          {/* Score bar */}
          <div className="mt-5">
            <div className="h-2 bg-surface-base rounded-full overflow-hidden border border-border-subtle">
              <div
                className={`h-full rounded-full transition-all ${passed ? "bg-success" : "bg-error"}`}
                style={{ width: `${attempt.score}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-muted">0%</span>
              <span className="text-xs text-muted">Passing: 70%</span>
              <span className="text-xs text-muted">100%</span>
            </div>
          </div>
        </div>

        {/* Answers */}
        <div className="space-y-4">
          {attempt.answers
            .sort((a, b) => a.order - b.order)
            .map((answer, idx) => {
              const q = answer.question;
              return (
                <div
                  key={answer.id}
                  className={`bg-surface-card rounded-xl px-6 py-5 border-2 shadow-sm ${
                    answer.isCorrect ? "border-success-border" : "border-error-border"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xs font-semibold text-secondary uppercase tracking-wide">
                      Question {idx + 1}
                    </h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                      answer.isCorrect
                        ? "bg-success-bg text-success border-success-border"
                        : "bg-error-bg text-error border-error-border"
                    }`}>
                      {answer.isCorrect ? "Correct" : "Incorrect"}
                    </span>
                  </div>
                  <p className="text-[14.5px] font-medium text-body mb-4 leading-snug">{q.stem}</p>

                  <div className="space-y-2 mb-4">
                    {q.options.map((opt) => {
                      const isSelected = opt.id === answer.selectedOptionId;
                      const isCorrect = opt.isCorrect;
                      let style = "border-border bg-surface-base";
                      if (isSelected && isCorrect) style = "border-success bg-success-bg";
                      else if (isSelected && !isCorrect) style = "border-error bg-error-bg";
                      else if (isCorrect) style = "border-success-border bg-success-bg";

                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-sm ${style}`}
                        >
                          <span className="w-4 text-center font-medium">
                            {isSelected && isCorrect && (
                              <span className="text-success">✓</span>
                            )}
                            {isSelected && !isCorrect && (
                              <span className="text-error">✗</span>
                            )}
                            {!isSelected && isCorrect && (
                              <span className="text-success">✓</span>
                            )}
                          </span>
                          <span className={isSelected || isCorrect ? "text-body font-medium" : "text-secondary"}>
                            {opt.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="bg-info-bg border border-info-border rounded-lg px-4 py-3">
                      <p className="text-xs font-semibold text-info mb-1">Explanation</p>
                      <p className="text-sm text-body">{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        <div className="mt-8 text-center">
          <Link
            href={`/${tenantSlug}/exams`}
            className="inline-flex h-10 items-center px-6 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
          >
            Back to exams
          </Link>
        </div>
      </div>
    </div>
  );
}

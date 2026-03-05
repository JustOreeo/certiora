"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";

type Option = { id: string; text: string };
type Question = {
  id: string;
  stem: string;
  options: Option[];
};
type Answer = {
  id: string;
  questionId: string;
  selectedOptionId: string;
  order: number;
  question: Question;
};
type Attempt = {
  id: string;
  examType: string;
  questionCount: number;
  status: string;
  answers: Answer[];
};

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function TakeExamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string; id: string }>();
  const tenantSlug = params.tenantSlug ?? "";
  const attemptId = params.id as string;

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
      if (res.ok) {
        setAttempt(data);
        const current = data.answers[currentIndex];
        setSelectedOption(current.selectedOptionId || "");
      } else {
        alert(data.error || "Failed to load attempt");
        router.push(`/${tenantSlug}/exams`);
      }
    } catch (error) {
      console.error("Failed to load attempt:", error);
      router.push(`/${tenantSlug}/exams`);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!attempt || !selectedOption) return;
    const currentAnswer = attempt.answers[currentIndex];

    try {
      await fetch(`/api/exams/attempts/${attemptId}/answers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentAnswer.questionId,
          selectedOptionId: selectedOption,
          order: currentAnswer.order,
        }),
      });

      if (currentIndex < attempt.answers.length - 1) {
        setCurrentIndex(currentIndex + 1);
        const next = attempt.answers[currentIndex + 1];
        setSelectedOption(next.selectedOptionId || "");
      }
    } catch (error) {
      console.error("Submit answer error:", error);
    }
  };

  const submitExam = async () => {
    if (!confirm("Submit exam? You won't be able to change your answers.")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/exams/attempts/${attemptId}/submit`, { method: "POST" });
      if (res.ok) {
        router.push(`/${tenantSlug}/exams/${attemptId}/review`);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to submit exam");
        setSubmitting(false);
      }
    } catch (error) {
      console.error("Submit exam error:", error);
      alert("Failed to submit exam");
      setSubmitting(false);
    }
  };

  if (loading || !attempt) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const currentAnswer = attempt.answers[currentIndex];
  const currentQuestion = currentAnswer.question;
  const isLastQuestion = currentIndex === attempt.answers.length - 1;
  const progress = Math.round(((currentIndex + 1) / attempt.questionCount) * 100);

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Minimal header */}
      <header className="h-[56px] bg-surface-card border-b border-border px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-heading">{attempt.examType.replace("_", " ")}</span>
          <span className="text-muted text-sm">·</span>
          <span className="text-sm text-secondary">
            Question {currentIndex + 1} of {attempt.questionCount}
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-40 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="px-8 py-8">
        {/* Question card */}
        <div className="bg-surface-card border border-border rounded-xl shadow-sm px-6 py-6 mb-4">
          <p className="text-[15px] font-medium text-body leading-relaxed mb-6">
            {currentQuestion.stem}
          </p>
          <div className="space-y-2.5">
            {currentQuestion.options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary-subtle"
                      : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-base"
                  }`}
                >
                  <input
                    type="radio"
                    name="option"
                    value={opt.id}
                    checked={isSelected}
                    onChange={(e) => setSelectedOption(e.target.value)}
                    className="sr-only"
                  />
                  {/* Custom radio */}
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? "border-primary" : "border-border-strong"
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <span className={`text-sm ${isSelected ? "text-body font-medium" : "text-body"}`}>
                    {opt.text}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => {
              if (currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
                const prev = attempt.answers[currentIndex - 1];
                setSelectedOption(prev.selectedOptionId || "");
              }
            }}
            disabled={currentIndex === 0}
            className="h-9 px-4 rounded-lg text-sm font-medium border border-border text-secondary hover:border-border-strong hover:text-body disabled:opacity-40 transition-colors"
          >
            Previous
          </button>

          {isLastQuestion ? (
            <button
              onClick={submitExam}
              disabled={submitting || !selectedOption}
              className="inline-flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-medium bg-success text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting ? <><Spinner /> Submitting…</> : "Submit exam"}
            </button>
          ) : (
            <button
              onClick={submitAnswer}
              disabled={!selectedOption}
              className="h-9 px-5 rounded-lg text-sm font-medium bg-primary text-inverse hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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
      const res = await fetch(`/api/exams/attempts/${attemptId}/submit`, {
        method: "POST",
      });
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
    return <div className="p-8">Loading...</div>;
  }

  const currentAnswer = attempt.answers[currentIndex];
  const currentQuestion = currentAnswer.question;
  const isLastQuestion = currentIndex === attempt.answers.length - 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-8">
        <div className="bg-white border rounded p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              Question {currentIndex + 1} of {attempt.questionCount}
            </h2>
            <span className="text-sm text-gray-600">
              {attempt.examType.replace("_", " ")}
            </span>
          </div>
          <p className="text-lg mb-6">{currentQuestion.stem}</p>
          <div className="space-y-3">
            {currentQuestion.options.map((opt) => (
              <label
                key={opt.id}
                className={`block p-4 border rounded cursor-pointer hover:bg-gray-50 ${
                  selectedOption === opt.id ? "border-blue-500 bg-blue-50" : ""
                }`}
              >
                <input
                  type="radio"
                  name="option"
                  value={opt.id}
                  checked={selectedOption === opt.id}
                  onChange={(e) => setSelectedOption(e.target.value)}
                  className="mr-3"
                />
                {opt.text}
              </label>
            ))}
          </div>
        </div>

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
            className="px-6 py-2 border rounded disabled:opacity-50"
          >
            Previous
          </button>

          {isLastQuestion ? (
            <button
              onClick={submitExam}
              disabled={submitting || !selectedOption}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Exam"}
            </button>
          ) : (
            <button
              onClick={submitAnswer}
              disabled={!selectedOption}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

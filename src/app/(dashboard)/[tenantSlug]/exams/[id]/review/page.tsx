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
  answers: Answer[];
};

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
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white border rounded p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">Exam Review</h1>
          <p className="text-gray-600 mb-4">
            {attempt.examType.replace("_", " ")} - Submitted on{" "}
            {new Date(attempt.submittedAt).toLocaleString()}
          </p>
          <div className="flex gap-6 text-lg">
            <div>
              <span className="font-semibold">Score:</span>{" "}
              <span className={attempt.score >= 70 ? "text-green-600" : "text-red-600"}>
                {attempt.score.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="font-semibold">Correct:</span>{" "}
              {attempt.answers.filter((a) => a.isCorrect).length} / {attempt.questionCount}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {attempt.answers
            .sort((a, b) => a.order - b.order)
            .map((answer, idx) => {
              const correctOption = answer.question.options.find((o) => o.isCorrect);
              const selectedOption = answer.question.options.find(
                (o) => o.id === answer.selectedOptionId
              );

              return (
                <div
                  key={answer.id}
                  className={`bg-white border-2 rounded p-6 ${
                    answer.isCorrect ? "border-green-300" : "border-red-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold">Question {idx + 1}</h3>
                    <span
                      className={`px-3 py-1 rounded text-sm ${
                        answer.isCorrect
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {answer.isCorrect ? "Correct" : "Incorrect"}
                    </span>
                  </div>
                  <p className="text-lg mb-4">{answer.question.stem}</p>

                  <div className="space-y-2 mb-4">
                    {answer.question.options.map((opt) => {
                      const isSelected = opt.id === answer.selectedOptionId;
                      const isCorrect = opt.isCorrect;
                      let bgColor = "";
                      if (isSelected && isCorrect) bgColor = "bg-green-100 border-green-500";
                      else if (isSelected && !isCorrect) bgColor = "bg-red-100 border-red-500";
                      else if (isCorrect) bgColor = "bg-green-50 border-green-300";

                      return (
                        <div
                          key={opt.id}
                          className={`p-3 border-2 rounded ${bgColor || "border-gray-200"}`}
                        >
                          <div className="flex items-center">
                            {isSelected && (
                              <span className="mr-2 font-semibold">
                                {isCorrect ? "✓" : "✗"}
                              </span>
                            )}
                            {isCorrect && !isSelected && (
                              <span className="mr-2 text-green-600">✓</span>
                            )}
                            <span>{opt.text}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {answer.question.explanation && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-4">
                      <p className="font-semibold mb-1">Explanation:</p>
                      <p className="text-sm">{answer.question.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        <div className="mt-8 text-center">
          <Link
            href={`/${tenantSlug}/exams`}
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Exams
          </Link>
        </div>
      </div>
    </div>
  );
}

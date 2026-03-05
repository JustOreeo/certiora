"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";

type Attempt = {
  id: string;
  examType: string;
  questionCount: number;
  score: number | null;
  status: string;
  submittedAt: string | null;
  createdAt: string;
};

export default function ExamsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params?.tenantSlug ?? "";
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      loadAttempts();
    }
  }, [status, router]);

  const loadAttempts = async () => {
    try {
      const res = await fetch("/api/exams/attempts");
      const data = await res.json();
      setAttempts(data || []);
    } catch (error) {
      console.error("Failed to load attempts:", error);
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examType: "SHORT_QUIZ" }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        router.push(`/${tenantSlug}/exams/${data.id}`);
      } else {
        alert(data.error || "Failed to start quiz");
        setStarting(false);
      }
    } catch (error) {
      console.error("Start quiz error:", error);
      alert("Failed to start quiz");
      setStarting(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">My Exams</h1>
          <button
            onClick={startQuiz}
            disabled={starting}
            className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {starting ? "Starting..." : "Start Short Quiz"}
          </button>
        </div>

        {attempts.length === 0 ? (
          <div className="bg-white border rounded p-8 text-center">
            <p className="text-gray-600">No attempts yet. Start your first quiz!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {attempts.map((a) => (
              <div
                key={a.id}
                className="bg-white border rounded p-4 hover:shadow cursor-pointer"
                onClick={() =>
                  router.push(
                    a.status === "SUBMITTED"
                      ? `/${tenantSlug}/exams/${a.id}/review`
                      : `/${tenantSlug}/exams/${a.id}`
                  )
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {a.examType.replace("_", " ")} ({a.questionCount} questions)
                    </h3>
                    <p className="text-sm text-gray-600">
                      {a.status === "SUBMITTED"
                        ? `Score: ${a.score?.toFixed(1)}% - ${new Date(
                            a.submittedAt!
                          ).toLocaleString()}`
                        : `In Progress - Started ${new Date(a.createdAt).toLocaleString()}`}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-sm ${
                      a.status === "SUBMITTED"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {a.status === "SUBMITTED" ? "Completed" : "In Progress"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

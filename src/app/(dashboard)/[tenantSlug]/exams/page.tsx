"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { signOut } from "next-auth/react";

type Attempt = {
  id: string;
  examType: string;
  questionCount: number;
  score: number | null;
  status: string;
  submittedAt: string | null;
  createdAt: string;
};

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CertioraLogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="9" fill="#4B4EFC" />
      <path d="M20 8L11 12V19C11 23.4 15 27.5 20 29C25 27.5 29 23.4 29 19V12L20 8Z" fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 19.5L18.5 22L24 17" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

  const completed = attempts.filter((a) => a.status === "SUBMITTED");
  const inProgress = attempts.filter((a) => a.status !== "SUBMITTED");

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Top nav */}
      <header className="h-[60px] bg-surface-card border-b border-border flex items-center px-6 justify-between">
        <div className="flex items-center gap-3">
          <CertioraLogoMark />
          <span className="font-semibold text-[15px] text-heading">Certiora</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-secondary hover:text-body transition-colors"
        >
          Sign out
        </button>
      </header>

      <div className="px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-[22px] font-semibold text-heading">My Exams</h1>
            <p className="text-sm text-secondary mt-0.5">
              {completed.length} completed · {inProgress.length} in progress
            </p>
          </div>
          <button
            onClick={startQuiz}
            disabled={starting}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-primary text-inverse hover:bg-primary-hover disabled:opacity-60 transition-colors"
          >
            {starting ? <><Spinner /> Starting…</> : "Start short quiz"}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner />
          </div>
        ) : attempts.length === 0 ? (
          <div className="bg-surface-card border border-border rounded-xl px-5 py-12 text-center shadow-sm">
            <p className="text-sm text-secondary">No attempts yet. Start your first quiz above!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {attempts.map((a) => {
              const isSubmitted = a.status === "SUBMITTED";
              return (
                <div
                  key={a.id}
                  className="bg-surface-card border border-border rounded-xl px-5 py-4 shadow-sm hover:border-border-strong transition-colors cursor-pointer"
                  onClick={() =>
                    router.push(
                      isSubmitted
                        ? `/${tenantSlug}/exams/${a.id}/review`
                        : `/${tenantSlug}/exams/${a.id}`
                    )
                  }
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-body">
                        {a.examType.replace("_", " ")}
                        <span className="text-muted font-normal ml-1.5">· {a.questionCount} questions</span>
                      </p>
                      <p className="text-xs text-secondary mt-1">
                        {isSubmitted
                          ? `Submitted ${new Date(a.submittedAt!).toLocaleString()}`
                          : `Started ${new Date(a.createdAt).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {isSubmitted ? (
                        <span className={`text-base font-semibold ${
                          (a.score ?? 0) >= 70 ? "text-success" : "text-error"
                        }`}>
                          {a.score?.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-warning-bg text-warning border-warning-border">
                          In Progress
                        </span>
                      )}
                      <span className="text-muted">
                        <IconChevronRight />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

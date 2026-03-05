"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type HomeData = {
  examsCompleted: number;
  averageScore: number | null;
  flashcardsDue: number;
  recentExams: Array<{
    id: string;
    examType: string;
    score: number | null;
    submittedAt: string | null;
  }>;
};

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function formatExamType(examType: string): string {
  return examType.replace(/_/g, " ");
}

export default function StudentHomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params?.tenantSlug ?? "";

  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/student/home")
        .then((res) => res.json())
        .then((json) => {
          if (json.examsCompleted != null) {
            setData({
              examsCompleted: json.examsCompleted ?? 0,
              averageScore: json.averageScore ?? null,
              flashcardsDue: json.flashcardsDue ?? 0,
              recentExams: Array.isArray(json.recentExams) ? json.recentExams : [],
            });
          } else {
            setData(null);
          }
        })
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }
  }, [status, router]);

  const firstName =
    session?.user?.name?.trim().split(/\s+/)[0] ?? null;
  const welcomeTitle = firstName
    ? `Welcome back, ${firstName}`
    : "Welcome back";

  if (status === "loading" || loading) {
    return (
      <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 flex items-center justify-center min-h-[200px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-heading text-[22px] font-semibold">{welcomeTitle}</h1>
        <p className="text-secondary text-sm mt-0.5">
          Here&apos;s your study progress at a glance.
        </p>
      </header>

      {data === null ? (
        <p className="text-secondary text-sm">Unable to load your progress. Please try again.</p>
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-surface-card border border-border rounded-xl p-6 shadow-sm">
              <p className="text-xs font-medium text-secondary uppercase tracking-wide mb-2">
                Exams Completed
              </p>
              <p className="text-3xl font-semibold text-heading">{data.examsCompleted}</p>
            </div>
            <div className="bg-surface-card border border-border rounded-xl p-6 shadow-sm">
              <p className="text-xs font-medium text-secondary uppercase tracking-wide mb-2">
                Average Score
              </p>
              <p className="text-3xl font-semibold text-heading">
                {data.averageScore != null ? `${data.averageScore}%` : "—"}
              </p>
            </div>
            <div className="bg-surface-card border border-border rounded-xl p-6 shadow-sm">
              <p className="text-xs font-medium text-secondary uppercase tracking-wide mb-2">
                Flashcards Due
              </p>
              <p className="text-3xl font-semibold text-heading">{data.flashcardsDue}</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-heading text-base font-semibold mb-3">Quick actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href={`/${tenantSlug}/exams`}
                className="bg-surface-card border border-border rounded-xl p-5 shadow-sm hover:border-primary hover:bg-primary-subtle/30 transition-colors block"
              >
                <p className="text-sm font-semibold text-heading">Start a Short Quiz</p>
                <p className="text-xs text-secondary mt-1">10–15 questions</p>
              </Link>
              <Link
                href={`/${tenantSlug}/flashcards`}
                className="bg-surface-card border border-border rounded-xl p-5 shadow-sm hover:border-primary hover:bg-primary-subtle/30 transition-colors block"
              >
                <p className="text-sm font-semibold text-heading">Review Flashcards</p>
                <p className="text-xs text-secondary mt-1">
                  {data.flashcardsDue > 0
                    ? `${data.flashcardsDue} due today`
                    : "No cards due today"}
                </p>
              </Link>
            </div>
          </section>

          <section>
            <h2 className="text-heading text-base font-semibold mb-3">Recent activity</h2>
            {data.recentExams.length === 0 ? (
              <div className="bg-surface-card border border-border rounded-xl px-5 py-10 text-center shadow-sm">
                <p className="text-sm text-secondary mb-4">
                  No exams yet. Start a short quiz to see your first results here.
                </p>
                <Link
                  href={`/${tenantSlug}/exams`}
                  className="inline-flex h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
                >
                  Start short quiz
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentExams.map((exam) => (
                  <Link
                    key={exam.id}
                    href={`/${tenantSlug}/exams/${exam.id}/review`}
                    className="flex items-center justify-between gap-4 bg-surface-card border border-border rounded-xl px-5 py-4 shadow-sm hover:border-border-strong transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-body">
                        {formatExamType(exam.examType)}
                      </p>
                      <p className="text-xs text-secondary mt-0.5">
                        {exam.submittedAt
                          ? `Submitted ${new Date(exam.submittedAt).toLocaleString()}`
                          : ""}
                      </p>
                    </div>
                    {exam.score != null && (
                      <span
                        className={`text-base font-semibold shrink-0 ${
                          exam.score >= 70 ? "text-success" : "text-error"
                        }`}
                      >
                        {exam.score.toFixed(1)}%
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

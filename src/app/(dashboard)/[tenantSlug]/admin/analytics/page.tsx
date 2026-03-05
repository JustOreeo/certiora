"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type TopicAccuracy = {
  topicId: string;
  topicName: string;
  subjectName: string;
  attemptCount: number;
  correctCount: number;
  accuracy: number;
  lastAttemptAt: string | null;
};

type ExamSummary = {
  totalExamsTaken: number;
  averageScore: number | null;
  activeStudentsCount: number;
};

type CohortData = {
  topicAccuracy: TopicAccuracy[];
  examSummary: ExamSummary;
};

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function accuracyColor(accuracy: number): string {
  if (accuracy >= 70) return "text-success";
  if (accuracy >= 50) return "text-warning";
  return "text-error";
}

export default function AdminAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params?.tenantSlug ?? "";

  const [data, setData] = useState<CohortData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      loadAnalytics();
    }
  }, [status, router]);

  const loadAnalytics = async () => {
    try {
      const res = await fetch("/api/admin/analytics");
      const json = await res.json();
      if (res.ok) {
        setData({
          topicAccuracy: json.topicAccuracy ?? [],
          examSummary: json.examSummary ?? {
            totalExamsTaken: 0,
            averageScore: null,
            activeStudentsCount: 0,
          },
        });
      } else {
        setData(null);
      }
    } catch (error) {
      console.error("Failed to load admin analytics:", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  const summary = data?.examSummary;
  const hasExamData = summary && (summary.totalExamsTaken > 0 || summary.activeStudentsCount > 0);

  return (
    <div className="px-8 py-8">
      <h1 className="text-[22px] font-semibold text-heading mb-2">Cohort Analytics</h1>
      <p className="text-sm text-secondary mb-6">
        Batch-wide topic performance and exam activity
      </p>

      {data && (
        <>
          {/* Exam activity summary */}
          <section className="mb-8">
            <h2 className="text-base font-semibold text-heading mb-3">Exam activity summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-card border border-border rounded-xl px-5 py-4 shadow-sm">
                <p className="text-xs font-medium text-secondary uppercase tracking-wide">Total exams taken</p>
                <p className="text-2xl font-semibold text-heading mt-1">{summary?.totalExamsTaken ?? 0}</p>
              </div>
              <div className="bg-surface-card border border-border rounded-xl px-5 py-4 shadow-sm">
                <p className="text-xs font-medium text-secondary uppercase tracking-wide">Average score</p>
                <p className={`text-2xl font-semibold mt-1 ${summary?.averageScore != null ? accuracyColor(summary.averageScore) : "text-body"}`}>
                  {summary?.averageScore != null ? `${summary.averageScore.toFixed(1)}%` : "—"}
                </p>
              </div>
              <div className="bg-surface-card border border-border rounded-xl px-5 py-4 shadow-sm">
                <p className="text-xs font-medium text-secondary uppercase tracking-wide">Active students</p>
                <p className="text-2xl font-semibold text-heading mt-1">{summary?.activeStudentsCount ?? 0}</p>
                <p className="text-xs text-secondary mt-0.5">At least one submitted exam</p>
              </div>
            </div>
          </section>

          {/* Topic accuracy across cohort */}
          <section>
            <h2 className="text-base font-semibold text-heading mb-3">Topic accuracy (batch)</h2>
            <p className="text-sm text-secondary mb-3">
              Which topics the cohort is weakest on, across all students
            </p>
            {!hasExamData || (data.topicAccuracy?.length ?? 0) === 0 ? (
              <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center shadow-sm">
                <p className="text-sm text-secondary">
                  No exam data yet. Once students take exams, topic accuracy will appear here.
                </p>
                <Link
                  href={`/${tenantSlug}/admin/students`}
                  className="inline-flex mt-4 h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
                >
                  View students
                </Link>
              </div>
            ) : (
              <div className="bg-surface-card border border-border rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-base">
                      <th className="text-left py-3 px-4 font-medium text-secondary">Subject</th>
                      <th className="text-left py-3 px-4 font-medium text-secondary">Topic</th>
                      <th className="text-right py-3 px-4 font-medium text-secondary">Attempts</th>
                      <th className="text-right py-3 px-4 font-medium text-secondary">Correct</th>
                      <th className="text-right py-3 px-4 font-medium text-secondary">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(data.topicAccuracy ?? [])]
                      .sort((a, b) => a.accuracy - b.accuracy)
                      .map((row) => (
                        <tr key={row.topicId} className="border-b border-border last:border-0">
                          <td className="py-3 px-4 text-body">{row.subjectName}</td>
                          <td className="py-3 px-4 text-body">{row.topicName}</td>
                          <td className="py-3 px-4 text-right text-body">{row.attemptCount}</td>
                          <td className="py-3 px-4 text-right text-body">{row.correctCount}</td>
                          <td className={`py-3 px-4 text-right font-medium ${accuracyColor(row.accuracy)}`}>
                            {row.accuracy.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {!data && !loading && (
        <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-secondary mb-4">
            We couldn’t load analytics. This might be a temporary issue.
          </p>
          <button
            type="button"
            onClick={() => { setLoading(true); loadAnalytics(); }}
            className="inline-flex h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

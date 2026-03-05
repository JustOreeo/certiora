"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type TopicPerformance = {
  topicId: string;
  topicName: string;
  subjectName: string;
  attemptCount: number;
  correctCount: number;
  accuracy: number;
  lastAttemptAt: string | null;
};
type Weakness = {
  topicId: string;
  topicName: string;
  subjectName: string;
  accuracy: number;
};
type ExamAttempt = {
  id: string;
  examType: string;
  questionCount: number;
  score: number | null;
  timeSpentSeconds: number | null;
  submittedAt: string | null;
};
type Dashboard = {
  topicPerformance: TopicPerformance[];
  weaknessHeatmap: Weakness[];
  examHistory: ExamAttempt[];
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

function accuracyColor(accuracy: number): string {
  if (accuracy >= 70) return "text-success";
  if (accuracy >= 50) return "text-warning";
  return "text-error";
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params?.tenantSlug ?? "";

  const [data, setData] = useState<Dashboard | null>(null);
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
      const res = await fetch("/api/analytics");
      const json = await res.json();
      if (res.ok) {
        setData({
          topicPerformance: json.topicPerformance ?? [],
          weaknessHeatmap: json.weaknessHeatmap ?? [],
          examHistory: json.examHistory ?? [],
        });
      } else {
        setData(null);
      }
    } catch (error) {
      console.error("Failed to load analytics:", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const isEmpty = data && data.examHistory.length === 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="px-8 py-8">
        <h1 className="text-[22px] font-semibold text-heading mb-2">My Analytics</h1>
        <p className="text-sm text-secondary mb-6">
          Topic performance and exam history
        </p>

        {isEmpty && (
          <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center shadow-sm">
            <p className="text-sm text-secondary">
              No data yet. Take your first quiz to see your analytics here.
            </p>
            <Link
              href={`/${tenantSlug}/exams`}
              className="inline-flex mt-4 h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
            >
              Go to exams
            </Link>
          </div>
        )}

        {data && !isEmpty && (
          <div className="space-y-8">
            {/* Topic performance table */}
            <section>
              <h2 className="text-base font-semibold text-heading mb-3">Topic performance</h2>
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
                    {data.topicPerformance.map((row) => (
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
            </section>

            {/* Weakness heatmap */}
            {data.weaknessHeatmap.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-heading mb-3">Weakest topics (min 3 attempts)</h2>
                <div className="bg-surface-card border border-border rounded-xl shadow-sm overflow-hidden">
                  <ul className="divide-y divide-border">
                    {data.weaknessHeatmap.map((w) => (
                      <li
                        key={w.topicId}
                        className="flex items-center justify-between py-3 px-4"
                      >
                        <div>
                          <span className="text-body font-medium">{w.topicName}</span>
                          <span className="text-muted text-xs ml-2">({w.subjectName})</span>
                        </div>
                        <span className={`font-semibold ${accuracyColor(w.accuracy)}`}>
                          {w.accuracy.toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* Exam history */}
            <section>
              <h2 className="text-base font-semibold text-heading mb-3">Exam history (last 30)</h2>
              <div className="space-y-2">
                {data.examHistory.map((a) => (
                  <Link
                    key={a.id}
                    href={`/${tenantSlug}/exams/${a.id}/review`}
                    className="block bg-surface-card border border-border rounded-xl px-5 py-4 shadow-sm hover:border-border-strong transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-body">
                          {a.examType.replace("_", " ")}
                          <span className="text-muted font-normal ml-1.5">
                            · {a.questionCount} questions
                          </span>
                        </p>
                        <p className="text-xs text-secondary mt-1">
                          {a.submittedAt
                            ? `Submitted ${new Date(a.submittedAt).toLocaleString()}${a.timeSpentSeconds != null ? ` · ${formatTimeSpent(a.timeSpentSeconds)}` : ""}`
                            : ""}
                        </p>
                      </div>
                      <span
                        className={`text-base font-semibold ${accuracyColor(a.score ?? 0)}`}
                      >
                        {a.score != null ? `${a.score.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

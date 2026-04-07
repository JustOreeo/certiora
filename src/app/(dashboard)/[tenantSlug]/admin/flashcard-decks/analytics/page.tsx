"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Overview = {
  totalStudents: number;
  reviewsLast30d: number;
  avgRetention: number;
  activeStudents7d: number;
};

type DeckStat = {
  deckId: string;
  deckName: string;
  status: string | null;
  studentsReached: number;
  totalReviews: number;
  retention: number;
  activeStudents7d: number;
};

type StudentStat = {
  userId: string;
  name: string;
  email: string;
  decksCount: number;
  reviews: number;
  retention: number;
  lastReviewed: string | null;
};

type AnalyticsData = {
  overview: Overview;
  perDeck: DeckStat[];
  perStudent: StudentStat[];
};

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-card border border-border rounded-xl p-4 shadow-sm">
      <p className="text-xs text-secondary font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-body mt-1">{value}</p>
    </div>
  );
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function relativeDate(dateStr: string | null) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString();
}

export default function AdminFlashcardAnalyticsPage() {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params?.tenantSlug ?? "";
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/${tenantSlug}/admin/flashcard-decks/analytics`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load analytics");
        return res.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-4 sm:px-6 md:px-8 py-6 max-w-6xl mx-auto">
        <p className="text-error">{error ?? "Failed to load analytics"}</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/${tenantSlug}/admin/flashcard-decks`}
          className="text-sm text-secondary hover:text-body mb-2 inline-block"
        >
          ← Flashcard Decks
        </Link>
        <h1 className="text-xl font-semibold text-body">Flashcard Analytics</h1>
        <p className="text-sm text-secondary mt-1">Student flashcard usage across your organization (last 30 days)</p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Students" value={data.overview.totalStudents} />
        <StatCard label="Reviews (30d)" value={data.overview.reviewsLast30d.toLocaleString()} />
        <StatCard label="Avg Retention" value={pct(data.overview.avgRetention)} />
        <StatCard label="Active (7d)" value={data.overview.activeStudents7d} />
      </div>

      {/* Per-deck table */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-body mb-3">Per-Deck Breakdown</h2>
        {data.perDeck.length === 0 ? (
          <p className="text-sm text-secondary">No admin decks found.</p>
        ) : (
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-base border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-secondary">Deck</th>
                  <th className="text-left px-4 py-3 font-medium text-secondary">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-secondary">Students</th>
                  <th className="text-right px-4 py-3 font-medium text-secondary">Reviews (30d)</th>
                  <th className="text-right px-4 py-3 font-medium text-secondary">Retention</th>
                  <th className="text-right px-4 py-3 font-medium text-secondary">Active (7d)</th>
                </tr>
              </thead>
              <tbody>
                {data.perDeck.map((d) => (
                  <tr key={d.deckId} className="border-b border-border last:border-0 hover:bg-surface-base/50">
                    <td className="px-4 py-3 text-body font-medium">{d.deckName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          d.status === "ACTIVE"
                            ? "bg-success-bg text-success border-success-border"
                            : d.status === "DRAFT"
                              ? "bg-surface-base text-secondary border-border"
                              : "bg-surface-base text-muted border-border"
                        }`}
                      >
                        {d.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-body">{d.studentsReached}</td>
                    <td className="px-4 py-3 text-right text-body">{d.totalReviews.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-body">{pct(d.retention)}</td>
                    <td className="px-4 py-3 text-right text-body">{d.activeStudents7d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Per-student table */}
      <div>
        <h2 className="text-lg font-medium text-body mb-3">Top Students (by Reviews)</h2>
        {data.perStudent.length === 0 ? (
          <p className="text-sm text-secondary">No student review activity in the last 30 days.</p>
        ) : (
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-base border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-secondary">Student</th>
                  <th className="text-right px-4 py-3 font-medium text-secondary">Decks</th>
                  <th className="text-right px-4 py-3 font-medium text-secondary">Reviews (30d)</th>
                  <th className="text-right px-4 py-3 font-medium text-secondary">Retention</th>
                  <th className="text-right px-4 py-3 font-medium text-secondary">Last Review</th>
                </tr>
              </thead>
              <tbody>
                {data.perStudent.map((s) => (
                  <tr key={s.userId} className="border-b border-border last:border-0 hover:bg-surface-base/50">
                    <td className="px-4 py-3">
                      <p className="text-body font-medium">{s.name}</p>
                      <p className="text-xs text-secondary">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-body">{s.decksCount}</td>
                    <td className="px-4 py-3 text-right text-body">{s.reviews.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-body">{pct(s.retention)}</td>
                    <td className="px-4 py-3 text-right text-secondary">{relativeDate(s.lastReviewed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

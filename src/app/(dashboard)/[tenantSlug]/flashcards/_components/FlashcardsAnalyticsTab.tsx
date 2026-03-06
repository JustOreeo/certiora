"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SourceBadge } from "./SourceBadge";

export type DeckSource = "PERSONAL" | "SHARED" | "ADMIN_SEEDED" | "EXAM_GENERATED" | null;

export type AnalyticsOverall = {
  total: number;
  new: number;
  learning: number;
  review: number;
  relearning: number;
  mature: number;
  retentionRate: number | null;
  avgStability: number | null;
  avgRetrievability: number | null;
  cardsAtRisk: number;
};

export type AnalyticsForecastDay = { date: string; count: number };

export type AnalyticsDeck = {
  deckId: string;
  name: string;
  source: DeckSource;
  total: number;
  new: number;
  learning: number;
  review: number;
  relearning: number;
  mature: number;
  avgStability: number | null;
  retentionRate: number | null;
  avgRetrievability: number | null;
  dueToday: number;
};

export type AnalyticsReviewDay = { date: string; count: number; correctCount: number };

export type FlashcardAnalytics = {
  overall: AnalyticsOverall;
  forecast: AnalyticsForecastDay[];
  decks: AnalyticsDeck[];
  reviewHistory: AnalyticsReviewDay[];
};

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  title,
}: {
  label: string;
  value: string | number;
  title?: string;
}) {
  return (
    <div
      className="bg-surface-card border border-border rounded-xl p-5 shadow-sm"
      title={title}
    >
      <p className="text-sm text-secondary mb-1">{label}</p>
      <p className="text-xl font-semibold text-body">{value}</p>
    </div>
  );
}

function RetentionColorClass(rate: number | null): string {
  if (rate == null) return "text-secondary";
  if (rate >= 70) return "text-success";
  if (rate >= 50) return "text-warning";
  return "text-error";
}

function RetrievabilityColorClass(pct: number | null): string {
  if (pct == null) return "text-secondary";
  if (pct >= 90) return "text-success";
  if (pct >= 70) return "text-warning";
  return "text-error";
}

function formatShortDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[d.getDay()]} ${d.getDate()}`;
}

function formatTooltipDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}

export function FlashcardsAnalyticsTab({
  tenantSlug,
  onNavigateToReview,
}: {
  tenantSlug: string;
  onNavigateToReview?: () => void;
}) {
  const [data, setData] = useState<FlashcardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/flashcards/analytics");
        if (!res.ok) throw new Error("Failed to load analytics");
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface-card border border-border rounded-xl px-6 py-8 text-center">
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const { overall, forecast, decks, reviewHistory } = data;

  // Empty state: no cards at all
  if (overall.total === 0) {
    return (
      <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center shadow-sm">
        <p className="text-body mb-2">No flashcard data yet.</p>
        <p className="text-sm text-secondary mb-4">
          Take exams or create custom decks to build your card collection.
        </p>
        {onNavigateToReview ? (
          <button
            type="button"
            onClick={onNavigateToReview}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Go to Review
          </button>
        ) : (
          <Link
            href={`/${tenantSlug}/flashcards`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Go to Review
          </Link>
        )}
      </div>
    );
  }

  const maxForecast = Math.max(1, ...forecast.map((f) => f.count));
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Overall stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total cards" value={overall.total} />
        <StatCard label="New" value={overall.new} />
        <StatCard label="Learning" value={overall.learning + overall.relearning} />
        <StatCard label="Review" value={overall.review} />
        <StatCard label="Mature" value={overall.mature} />
        <StatCard
          label="Avg. Stability"
          value={overall.avgStability != null ? `${overall.avgStability.toFixed(1)}d` : "—"}
        />
      </div>

      {/* Avg. Retrievability + Cards at risk */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-secondary mb-1">Avg. Retrievability now</p>
          <p className={`text-xl font-semibold ${RetrievabilityColorClass(overall.avgRetrievability)}`}>
            {overall.avgRetrievability != null
              ? `${overall.avgRetrievability.toFixed(0)}%`
              : "—"}
          </p>
          <p className="text-xs text-secondary mt-1">
            How much of your deck you could recall right now
          </p>
        </div>
        <div className="bg-surface-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-secondary mb-1">Cards at risk</p>
          <p className="text-xl font-semibold text-body">{overall.cardsAtRisk}</p>
          {overall.cardsAtRisk > 0 && (
            <>
              {onNavigateToReview ? (
                <button
                  type="button"
                  onClick={onNavigateToReview}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline mt-1"
                >
                  Review now →
                </button>
              ) : (
                <Link
                  href={`/${tenantSlug}/flashcards`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline mt-1"
                >
                  Review now →
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* Retention rate */}
      <div className="bg-surface-card border border-border rounded-xl p-5 shadow-sm">
        <p className="text-sm text-secondary mb-1">Retention rate</p>
        <p className={`text-2xl font-semibold ${RetentionColorClass(overall.retentionRate)}`}>
          {overall.retentionRate != null ? `${overall.retentionRate.toFixed(1)}%` : "—"}
        </p>
        <p className="text-xs text-secondary mt-1">
          {overall.retentionRate != null
            ? "Percentage of review attempts answered correctly (Good/Easy = correct)"
            : "Review some cards to see your retention rate."}
        </p>
      </div>

      {/* 14-day forecast */}
      <div className="bg-surface-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-body mb-4">Review forecast</h2>
        {maxForecast === 0 || forecast.every((f) => f.count === 0) ? (
          <p className="text-sm text-secondary">No cards due in the next 14 days.</p>
        ) : (
          <div
            className="flex items-end gap-1 sm:gap-2 border-b border-border pb-1"
            style={{ height: 140 }}
          >
            {forecast.map(({ date, count }) => {
              const isToday = date === todayStr;
              const heightPct = maxForecast > 0 ? (count / maxForecast) * 100 : 0;
              return (
                <div
                  key={date}
                  className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                  title={`${formatTooltipDay(date)} — ${count} due`}
                >
                  <div
                    className="w-full rounded-t min-h-[4px]"
                    style={{
                      height: `${Math.max(heightPct, count > 0 ? 4 : 0)}%`,
                      backgroundColor: isToday ? "var(--color-primary)" : "var(--color-border)",
                      maxHeight: "100%",
                    }}
                  />
                  <span className="text-xs text-secondary truncate w-full text-center mt-1">
                    {formatShortDay(date)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Per-deck table */}
      <div className="bg-surface-card border border-border rounded-xl shadow-sm overflow-hidden">
        <h2 className="text-sm font-semibold text-body px-5 py-4 border-b border-border">
          Per-deck breakdown
        </h2>
        {decks.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-secondary">
              No decks with cards yet. Start reviewing to see per-deck stats here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-base/50">
                  <th className="text-left py-3 px-4 font-medium text-body">Deck</th>
                  <th className="text-right py-3 px-4 font-medium text-body">Total</th>
                  <th className="text-right py-3 px-4 font-medium text-body">New</th>
                  <th className="text-right py-3 px-4 font-medium text-body">Learning</th>
                  <th className="text-right py-3 px-4 font-medium text-body">Mature</th>
                  <th className="text-right py-3 px-4 font-medium text-body">Avg. Stability</th>
                  <th className="text-right py-3 px-4 font-medium text-body">Retention</th>
                  <th className="text-right py-3 px-4 font-medium text-body">Due today</th>
                </tr>
              </thead>
              <tbody>
                {decks.map((deck) => (
                  <tr key={deck.deckId} className="border-b border-border last:border-0">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/${tenantSlug}/flashcards/decks/${deck.deckId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {deck.name}
                        </Link>
                        <SourceBadge source={deck.source} />
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-body">{deck.total}</td>
                    <td className="text-right py-3 px-4 text-body">{deck.new}</td>
                    <td className="text-right py-3 px-4 text-body">
                      {deck.learning + deck.relearning}
                    </td>
                    <td className="text-right py-3 px-4 text-body">{deck.mature}</td>
                    <td className="text-right py-3 px-4 text-body">
                      {deck.avgStability != null ? `${deck.avgStability.toFixed(1)}d` : "—"}
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={RetentionColorClass(deck.retentionRate)}>
                        {deck.retentionRate != null ? `${deck.retentionRate.toFixed(0)}%` : "—"}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 font-medium text-body">
                      {deck.dueToday}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 30-day review history */}
      <div className="bg-surface-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-body mb-4">Review history (last 30 days)</h2>
        {reviewHistory.every((d) => d.count === 0) ? (
          <p className="text-sm text-secondary">
            No review history yet. Complete a review session to start tracking.
          </p>
        ) : (
          <div
            className="flex flex-wrap gap-1"
            style={{ maxWidth: "100%" }}
            role="img"
            aria-label="Review activity by day"
          >
            {reviewHistory.map(({ date, count }) => {
              let opacity = 0.15;
              if (count >= 16) opacity = 1;
              else if (count >= 6) opacity = 0.65;
              else if (count >= 1) opacity = 0.35;
              return (
                <div
                  key={date}
                  className="w-3 h-3 sm:w-4 sm:h-4 rounded-sm flex-shrink-0"
                  style={{
                    backgroundColor: count > 0 ? "var(--color-primary)" : "var(--color-border)",
                    opacity: count > 0 ? opacity : 0.4,
                  }}
                  title={`${formatTooltipDay(date)} — ${count} reviews`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const RETENTION_OPTIONS = [
  { value: 0.7, label: "70%", sublabel: "Lightest" },
  { value: 0.8, label: "80%", sublabel: "Light" },
  { value: 0.9, label: "90%", sublabel: "Standard" },
  { value: 0.95, label: "95%", sublabel: "Thorough" },
  { value: 0.97, label: "97%", sublabel: "Maximum" },
] as const;

/** Approximate interval in days for a stable card (S=21) at given retention target. */
function intervalDaysAt(retentionTarget: number): number {
  const r = Math.max(0.01, Math.min(0.99, retentionTarget));
  const mult = (Math.pow(r, -2) - 1) * (81 / 19);
  return Math.max(1, Math.round(21 * mult));
}

export type FsrsSettings = {
  retentionTarget: number;
  isOptimized: boolean;
  optimizedAt: string | null;
  reviewCount: number;
  reviewCountAtOptimization: number | null;
  w: number[] | null;
  tenantDefault: { retentionTarget: number };
  customRetentionDecks: Array<{
    id: string;
    name: string;
    source: string | null;
    retentionTarget: number | null;
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

export function FlashcardsSettingsTab({ tenantSlug }: { tenantSlug: string }) {
  const [settings, setSettings] = useState<FsrsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/flashcards/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      setSettings(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleRetentionChange = async (value: number) => {
    if (!settings || saving || Math.abs(settings.retentionTarget - value) < 0.001) return;
    setSaving(true);
    try {
      const res = await fetch("/api/flashcards/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionTarget: value }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      setSettings(data);
      showToast("Review intensity updated.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="bg-surface-card border border-border rounded-xl px-6 py-8 text-center">
        <p className="text-sm text-error" role="alert">
          {error ?? "Failed to load settings"}
        </p>
      </div>
    );
  }

  const tenantPct = Math.round(settings.tenantDefault.retentionTarget * 100);
  const currentDays = intervalDaysAt(settings.retentionTarget);

  return (
    <div className="space-y-8 relative">
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-primary text-inverse text-sm font-medium shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}
      {/* Panel 1 — Review intensity */}
      <div className="bg-surface-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-body mb-1">Review intensity</h2>
        <p className="text-sm text-secondary mb-4">
          Controls how often you see each card. Higher retention means more reviews per day — cards
          return sooner. Lower means fewer reviews, with some forgetting accepted.
        </p>
        <div
          className="flex flex-wrap gap-1 p-1 rounded-lg bg-surface-base border border-border"
          role="group"
          aria-label="Retention target"
        >
          {RETENTION_OPTIONS.map((opt) => {
            const isActive = Math.abs(settings.retentionTarget - opt.value) < 0.001;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleRetentionChange(opt.value)}
                disabled={saving}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-inverse"
                    : "text-body hover:bg-surface-card border border-transparent"
                } disabled:opacity-50`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-secondary mt-2">
          Your organization&apos;s default: {tenantPct}%.
        </p>
        <p className="text-sm text-secondary mt-3">
          At {Math.round(settings.retentionTarget * 100)}%, a card you know well will return in
          ~{currentDays} days. At 90%, it would return in ~21 days; at 95%, ~10 days (more
          reviews).
        </p>
        <p className="text-xs text-secondary mt-2">
          Individual decks can have their own intensity setting — open a deck to override it.
        </p>
      </div>

      {/* Panel 2 — Personalized schedule (Phase 8 placeholder) */}
      <div className="bg-surface-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-body mb-1">Personalized schedule</h2>
        <p className="text-sm text-secondary mb-4">
          The FSRS algorithm can learn your personal forgetting curve. Once it does, your review
          intervals will be calibrated to how quickly you actually forget.
        </p>
        <div className="rounded-lg bg-surface-base border border-border px-4 py-6 text-center">
          <p className="text-sm text-secondary">
            {settings.reviewCount} / 1,000 reviews — personalization unlocks at 1,000 reviews.
          </p>
          <div
            className="mt-3 h-2 rounded-full bg-border overflow-hidden"
            style={{ maxWidth: 320 }}
          >
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (settings.reviewCount / 1000) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Panel 3 — Per-deck intensity overview */}
      <div className="bg-surface-card border border-border rounded-xl shadow-sm overflow-hidden">
        <h2 className="text-base font-semibold text-body px-5 py-4 border-b border-border">
          Per-deck intensity overview
        </h2>
        {!settings.customRetentionDecks.length ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-secondary">
              No per-deck overrides set. Use the deck detail page to customize individual decks.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-base/50">
                  <th className="text-left py-3 px-4 font-medium text-body">Deck</th>
                  <th className="text-right py-3 px-4 font-medium text-body">Custom target</th>
                  <th className="text-right py-3 px-4 font-medium text-body">vs. account default</th>
                </tr>
              </thead>
              <tbody>
                {settings.customRetentionDecks.map((deck) => {
                  const pct = deck.retentionTarget != null ? Math.round(deck.retentionTarget * 100) : null;
                  const accountPct = Math.round(settings.retentionTarget * 100);
                  const diff = pct != null ? pct - accountPct : 0;
                  const diffStr = diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : "—";
                  return (
                    <tr key={deck.id} className="border-b border-border last:border-0">
                      <td className="py-3 px-4">
                        <Link
                          href={`/${tenantSlug}/flashcards/decks/${deck.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {deck.name}
                        </Link>
                      </td>
                      <td className="text-right py-3 px-4 text-body">
                        {pct != null ? `${pct}%` : "—"}
                      </td>
                      <td className="text-right py-3 px-4 text-secondary">{diffStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

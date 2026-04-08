"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";

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

function formatOptimizedAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return d.toLocaleDateString();
}

const PHASE_COLORS: Record<string, string> = {
  BUILD: "bg-emerald-100 text-emerald-700 border-emerald-200",
  STRENGTHEN: "bg-sky-100 text-sky-700 border-sky-200",
  CONSOLIDATE: "bg-amber-100 text-amber-700 border-amber-200",
  SHARPEN: "bg-orange-100 text-orange-700 border-orange-200",
  PEAK: "bg-red-100 text-red-700 border-red-200",
};

type ReviewIntensityInfo = {
  phase: string;
  phaseLabel: string;
  phaseDescription: string;
  daysRemaining: number;
  suggestedRetentionTarget: number;
  effectiveRetentionTarget: number;
  isManualOverride: boolean;
  coveragePercent: number;
  coverageOverrideApplied: boolean;
  effectiveNewCardLimit: number;
};

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
  optimizeJobQueuedOrActive?: boolean;
  examDate: string | null;
  reviewIntensity: ReviewIntensityInfo | null;
};

export function OverrideConfirmModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface-card border border-border rounded-xl shadow-lg max-w-md mx-4 p-6">
        <h3 className="text-base font-semibold text-heading mb-2">
          Change review schedule?
        </h3>
        <p className="text-sm text-body mb-3">
          Your review schedule is currently set up to match your exam timeline.
          The system learns how quickly you forget and adjusts the timing of each
          card so you remember it right when it matters most.
        </p>
        <p className="text-sm text-body mb-4">
          Changing this manually means your reviews won&apos;t adapt as your exam
          gets closer. Most students get better results by letting the system
          handle this automatically.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover"
          >
            Keep current schedule
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-9 px-4 rounded-lg text-sm font-medium text-secondary hover:text-body border border-border"
          >
            Change anyway
          </button>
        </div>
      </div>
    </div>
  );
}

export function FlashcardsSettingsTab({ tenantSlug }: { tenantSlug: string }) {
  const [settings, setSettings] = useState<FsrsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [examDateInput, setExamDateInput] = useState("");
  const [pendingRetention, setPendingRetention] = useState<number | null>(null);

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
      if (data.examDate) {
        setExamDateInput(data.examDate.slice(0, 10));
      }
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

  // Poll every 5s when optimization job is queued or running (State C)
  const isPolling = settings?.optimizeJobQueuedOrActive === true;
  useEffect(() => {
    if (!isPolling) return;
    const id = setInterval(loadSettings, 5000);
    return () => clearInterval(id);
  }, [isPolling, loadSettings]);

  const handleOptimizeNow = async () => {
    try {
      const res = await fetch("/api/flashcards/settings/optimize", { method: "POST" });
      if (res.status === 400) {
        showToast("Need at least 1,000 reviews to optimize.");
        return;
      }
      if (res.status === 409) {
        showToast("Optimization already queued or running.");
        loadSettings();
        return;
      }
      if (!res.ok) throw new Error("Failed to start");
      loadSettings();
      showToast("Optimization started. This usually takes under a minute.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to start optimization.");
    }
  };

  const handleResetParams = async () => {
    if (!confirm("Reset to FSRS default parameters? Your personal optimization data will not be deleted — you can re-run it at any time.")) return;
    try {
      const res = await fetch("/api/flashcards/settings/reset-params", { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset");
      const data = await res.json();
      setSettings(data);
      showToast("Parameters reset to defaults.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Reset failed.");
    }
  };

  const patchSettings = async (body: Record<string, unknown>, toastMsg: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/flashcards/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      setSettings(data);
      if (data.examDate) {
        setExamDateInput(data.examDate.slice(0, 10));
      } else {
        setExamDateInput("");
      }
      showToast(toastMsg);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleRetentionChange = async (value: number) => {
    if (!settings || saving || Math.abs(settings.retentionTarget - value) < 0.001) return;
    // Show confirmation when exam schedule is active (auto mode)
    if (settings.reviewIntensity && !settings.reviewIntensity.isManualOverride) {
      setPendingRetention(value);
      return;
    }
    await patchSettings({ retentionTarget: value }, "Review intensity updated.");
  };

  const confirmRetentionOverride = async () => {
    if (pendingRetention == null) return;
    setPendingRetention(null);
    await patchSettings({ retentionTarget: pendingRetention }, "Review intensity updated.");
  };

  const handleSetExamDate = async () => {
    if (!examDateInput || saving) return;
    await patchSettings(
      { examDate: new Date(examDateInput + "T00:00:00Z").toISOString() },
      "Exam date set. Review intensity will adapt automatically."
    );
  };

  const handleClearExamDate = async () => {
    if (saving) return;
    setExamDateInput("");
    await patchSettings({ examDate: null }, "Exam date cleared.");
  };

  const handleUseSuggestion = async () => {
    if (saving) return;
    await patchSettings({ retentionManualOverride: false }, "Using exam-based suggestion.");
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
  const ri = settings.reviewIntensity;
  const examActive = ri != null;
  const autoMode = examActive && !ri.isManualOverride;

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

      <OverrideConfirmModal
        open={pendingRetention != null}
        onConfirm={confirmRetentionOverride}
        onCancel={() => setPendingRetention(null)}
      />

      {/* Panel 0 — Exam countdown */}
      <div className="bg-surface-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-body mb-1">Board exam date</h2>
        <p className="text-sm text-secondary mb-4">
          Set your exam date and the system will automatically adjust review intensity as it approaches.
        </p>

        {!settings.examDate ? (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor="exam-date" className="block text-xs font-medium text-secondary mb-1">
                Exam date
              </label>
              <input
                id="exam-date"
                type="date"
                value={examDateInput}
                onChange={(e) => setExamDateInput(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-surface-base text-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              type="button"
              onClick={handleSetExamDate}
              disabled={saving || !examDateInput}
              className="h-10 px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover disabled:opacity-50"
            >
              Set date
            </button>
          </div>
        ) : ri ? (
          <div className="space-y-4">
            {/* Countdown + phase badge */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl font-bold text-heading tabular-nums">
                {ri.daysRemaining}
              </span>
              <span className="text-sm text-secondary">
                {ri.daysRemaining === 1 ? "day" : "days"} remaining
              </span>
              <span
                className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  PHASE_COLORS[ri.phase] ?? "bg-surface-base text-body border-border"
                }`}
              >
                {ri.phaseLabel}
              </span>
            </div>

            {/* Phase description */}
            <p className="text-sm text-secondary">{ri.phaseDescription}</p>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-surface-base border border-border px-3 py-2">
                <p className="text-xs text-secondary">Target retention</p>
                <p className="text-sm font-semibold text-body">
                  {Math.round(ri.effectiveRetentionTarget * 100)}%
                </p>
              </div>
              <div className="rounded-lg bg-surface-base border border-border px-3 py-2">
                <p className="text-xs text-secondary">Cards seen</p>
                <p className="text-sm font-semibold text-body">{ri.coveragePercent}%</p>
              </div>
              <div className="rounded-lg bg-surface-base border border-border px-3 py-2">
                <p className="text-xs text-secondary">New cards/day</p>
                <p className="text-sm font-semibold text-body">
                  ~{ri.effectiveNewCardLimit}
                </p>
              </div>
            </div>

            {/* Coverage override notice */}
            {ri.coverageOverrideApplied && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2 border border-amber-200">
                Coverage is below 50% — new cards are still being introduced aggressively despite the {ri.phaseLabel} phase.
              </p>
            )}

            {/* Clear exam date */}
            <button
              type="button"
              onClick={handleClearExamDate}
              disabled={saving}
              className="text-xs text-secondary hover:text-body underline disabled:opacity-50"
            >
              Clear exam date
            </button>
          </div>
        ) : (
          /* Exam date in the past */
          <div className="rounded-lg bg-surface-base border border-border px-4 py-4 text-center">
            <p className="text-sm text-secondary">Your exam date has passed.</p>
            <button
              type="button"
              onClick={handleClearExamDate}
              disabled={saving}
              className="mt-2 text-sm text-primary hover:underline disabled:opacity-50"
            >
              Clear exam date
            </button>
          </div>
        )}
      </div>

      {/* Panel 1 — Review intensity */}
      <div className="bg-surface-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-body mb-1">Review intensity</h2>
        <p className="text-sm text-secondary mb-4">
          Controls how often you see each card. Higher retention means more reviews per day — cards
          return sooner. Lower means fewer reviews, with some forgetting accepted.
        </p>

        {/* Auto-managed notice when exam is active */}
        {autoMode && (
          <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 mb-4">
            <p className="text-sm text-body">
              Managed by exam schedule ({ri!.phaseLabel} phase — {Math.round(ri!.suggestedRetentionTarget * 100)}% retention).{" "}
              <button
                type="button"
                onClick={() => handleRetentionChange(settings.retentionTarget)}
                className="text-primary hover:underline font-medium"
              >
                Override manually
              </button>
            </p>
          </div>
        )}

        {/* Manual override notice */}
        {examActive && ri!.isManualOverride && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 mb-4">
            <p className="text-sm text-body">
              You are overriding the exam suggestion (suggested: {Math.round(ri!.suggestedRetentionTarget * 100)}%).{" "}
              <button
                type="button"
                onClick={handleUseSuggestion}
                disabled={saving}
                className="text-primary hover:underline font-medium disabled:opacity-50"
              >
                Use suggestion
              </button>
            </p>
          </div>
        )}

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
                disabled={saving || autoMode}
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

      {/* Panel 2 — Personalized schedule (Phase 8) */}
      <div className="bg-surface-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-body mb-1">Personalized schedule</h2>
        <p className="text-sm text-secondary mb-4">
          The FSRS algorithm can learn your personal forgetting curve. Once it does, your review
          intervals will be calibrated to how quickly you actually forget.
        </p>

        {/* State A: < 1,000 reviews */}
        {settings.reviewCount < 1000 && (
          <div className="rounded-lg bg-surface-base border border-border px-4 py-6 text-center">
            <div
              className="mx-auto h-2 rounded-full bg-border overflow-hidden"
              style={{ maxWidth: 320 }}
            >
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (settings.reviewCount / 1000) * 100)}%` }}
              />
            </div>
            <p className="text-sm text-secondary mt-3">
              {settings.reviewCount} / 1,000 reviews
            </p>
            <p className="text-xs text-secondary mt-1">
              {1000 - settings.reviewCount} reviews remaining. Personalization unlocks at 1,000 reviews.
            </p>
          </div>
        )}

        {/* State B: >= 1,000, not optimized, job not queued */}
        {settings.reviewCount >= 1000 && !settings.isOptimized && !settings.optimizeJobQueuedOrActive && (
          <div className="rounded-lg bg-surface-base border border-border px-4 py-6 text-center">
            <p className="text-sm text-success font-medium">You&apos;ve completed {settings.reviewCount.toLocaleString()} reviews.</p>
            <p className="text-sm text-secondary mt-1">Your schedule can now be personalized.</p>
            <button
              type="button"
              onClick={handleOptimizeNow}
              className="mt-4 h-10 px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover"
            >
              Optimize now
            </button>
          </div>
        )}

        {/* State C: Job queued or running */}
        {settings.optimizeJobQueuedOrActive && (
          <div className="rounded-lg bg-surface-base border border-border px-4 py-6 text-center">
            <Spinner />
            <p className="text-sm text-body mt-3">Personalizing your schedule…</p>
            <p className="text-xs text-secondary mt-1">This usually takes under a minute.</p>
          </div>
        )}

        {/* State D: Optimized */}
        {settings.reviewCount >= 1000 && settings.isOptimized && !settings.optimizeJobQueuedOrActive && (
          <div className="rounded-lg bg-surface-base border border-border px-4 py-6">
            <p className="text-sm text-success font-medium">Personalized schedule active</p>
            <p className="text-xs text-secondary mt-1">
              Optimized {settings.optimizedAt ? formatOptimizedAt(settings.optimizedAt) : ""}
              {settings.reviewCountAtOptimization != null && (
                <> · Based on {settings.reviewCountAtOptimization.toLocaleString()} reviews</>
              )}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                onClick={handleOptimizeNow}
                disabled={
                  settings.reviewCountAtOptimization != null &&
                  settings.reviewCount - settings.reviewCountAtOptimization < 200
                }
                className="h-9 px-4 rounded-lg text-sm font-medium border border-border bg-surface-card hover:bg-surface-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Run again
              </button>
              <button
                type="button"
                onClick={handleResetParams}
                className="h-9 px-4 rounded-lg text-sm font-medium text-secondary hover:text-body"
              >
                Reset to defaults
              </button>
            </div>
            {settings.reviewCountAtOptimization != null && settings.reviewCount - settings.reviewCountAtOptimization < 200 && (
              <p className="text-xs text-secondary mt-2">
                Run again is available after 200 new reviews ({(settings.reviewCountAtOptimization + 200) - settings.reviewCount} more).
              </p>
            )}
          </div>
        )}
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
                  <th scope="col" className="text-left py-3 px-4 font-medium text-body">Deck</th>
                  <th scope="col" className="text-right py-3 px-4 font-medium text-body">Custom target</th>
                  <th scope="col" className="text-right py-3 px-4 font-medium text-body">vs. account default</th>
                </tr>
              </thead>
              <tbody>
                {settings.customRetentionDecks.map((deck) => {
                  const pct = deck.retentionTarget != null ? Math.round(deck.retentionTarget * 100) : null;
                  const accountPct = Math.round(settings.retentionTarget * 100);
                  const diff = pct != null ? pct - accountPct : 0;
                  const diffStr = diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : "---";
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
                        {pct != null ? `${pct}%` : "---"}
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

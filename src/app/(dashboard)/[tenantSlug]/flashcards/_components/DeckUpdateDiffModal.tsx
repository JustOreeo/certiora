"use client";

import { useState, useEffect } from "react";
import { toUserMessage } from "@/lib/errors";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export type DeckDiff = {
  newCards: { id: string; front: string; back: string }[];
  updatedCards: {
    imported: { id: string; front: string; back: string };
    source: { id: string; front: string; back: string };
  }[];
  removedCards: { id: string; front: string }[];
  sourceVersion: number;
};

type Props = {
  open: boolean;
  deckId: string;
  onClose: () => void;
  onApplied: () => void;
};

export function DeckUpdateDiffModal({ open, deckId, onClose, onApplied }: Props) {
  const [diff, setDiff] = useState<DeckDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !deckId) {
      setDiff(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/flashcards/decks/${deckId}/diff`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Failed to load changes.");
          setDiff(null);
          return;
        }
        setDiff(data);
      })
      .catch((err) => {
        setError(toUserMessage(err, "Failed to load changes."));
        setDiff(null);
      })
      .finally(() => setLoading(false));
  }, [open, deckId]);

  const handleApply = async () => {
    if (!diff) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}/apply-update`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to apply changes.");
        return;
      }
      onApplied();
      onClose();
    } catch (err) {
      setError(toUserMessage(err, "Failed to apply changes."));
    } finally {
      setApplying(false);
    }
  };

  const handleMarkReviewed = async () => {
    await handleApply();
  };

  const contentRef = useFocusTrap(open, onClose);

  if (!open) return null;

  const totalChanges =
    (diff?.newCards.length ?? 0) + (diff?.updatedCards.length ?? 0) + (diff?.removedCards.length ?? 0);
  const onlyRemovals =
    diff &&
    diff.newCards.length === 0 &&
    diff.updatedCards.length === 0 &&
    diff.removedCards.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deck-update-diff-title"
    >
      <div ref={contentRef} className="bg-surface-card border border-border rounded-xl shadow-lg max-w-2xl w-full my-8 max-h-[90vh] flex flex-col outline-none" tabIndex={-1}>
        <h2 id="deck-update-diff-title" className="text-lg font-semibold text-body p-6 pb-0">
          Deck updates
        </h2>

        {loading && (
          <div className="p-6 flex items-center gap-2 text-sm text-secondary">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Loading changes…
          </div>
        )}

        {error && (
          <p className="mx-6 mt-4 text-sm text-error" role="alert">
            {error}
          </p>
        )}

        {diff && !loading && (
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {diff.newCards.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-success mb-2 rounded-lg px-2 py-1 bg-success-bg border border-success-border inline-block">
                  {diff.newCards.length} New
                </h3>
                <ul className="space-y-2">
                  {diff.newCards.map((c) => (
                    <li
                      key={c.id}
                      className="bg-surface-base border border-border rounded-lg p-3 text-sm"
                    >
                      <p className="font-medium text-body break-words">{c.front}</p>
                      <details className="mt-1">
                        <summary className="text-secondary cursor-pointer">Show back</summary>
                        <p className="mt-1 text-body whitespace-pre-wrap break-words">{c.back}</p>
                      </details>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-secondary mt-1">
                  These will be added with default SRS state (due now).
                </p>
              </section>
            )}

            {diff.updatedCards.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-info mb-2 rounded-lg px-2 py-1 bg-info-bg border border-info-border inline-block">
                  {diff.updatedCards.length} Updated
                </h3>
                <ul className="space-y-3">
                  {diff.updatedCards.map((pair, i) => (
                    <li
                      key={pair.imported.id}
                      className="bg-surface-base border border-border rounded-lg p-3 text-sm"
                    >
                      <p className="text-secondary text-xs mb-1">Front:</p>
                      <p className="line-through text-muted">{pair.imported.front}</p>
                      <p className="text-body font-medium mt-1">→ {pair.source.front}</p>
                      <details className="mt-2">
                        <summary className="text-secondary cursor-pointer">Back (before → after)</summary>
                        <p className="line-through text-muted mt-1">{pair.imported.back}</p>
                        <p className="text-body mt-1">→ {pair.source.back}</p>
                      </details>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-secondary mt-1">
                  Your review progress for these cards will not be reset.
                </p>
              </section>
            )}

            {diff.removedCards.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-body mb-2 rounded-lg px-2 py-1 bg-surface-base border border-border inline-block">
                  {diff.removedCards.length} Removed
                </h3>
                <ul className="space-y-2">
                  {diff.removedCards.map((c) => (
                    <li
                      key={c.id}
                      className="bg-surface-base border border-border rounded-lg p-3 text-sm"
                    >
                      <p className="text-body break-words">{c.front}</p>
                      <p className="text-xs text-secondary italic mt-1">
                        This card no longer exists in the original deck. You can delete it manually.
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {diff && !loading && (
          <div className="flex justify-end gap-2 p-6 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card"
            >
              Cancel
            </button>
            {totalChanges > 0 && (
              <button
                type="button"
                onClick={onlyRemovals ? handleMarkReviewed : handleApply}
                disabled={applying}
                className="h-10 px-4 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover disabled:opacity-50"
              >
                {applying
                  ? "Applying…"
                  : onlyRemovals
                    ? "Mark as reviewed"
                    : `Apply ${totalChanges} change${totalChanges !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

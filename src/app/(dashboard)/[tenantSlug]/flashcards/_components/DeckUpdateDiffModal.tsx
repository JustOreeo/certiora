"use client";

import { useState, useEffect } from "react";
import { toUserMessage } from "@/lib/errors";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { Spinner } from "@/components/ui/Spinner";

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

const PREVIEW_LIMIT = 5;

function DiffSection({
  label,
  count,
  badgeClass,
  defaultOpen,
  children,
}: {
  label: string;
  count: number;
  badgeClass: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left cursor-pointer group"
        aria-expanded={open}
      >
        <span
          className={`text-sm font-semibold rounded-lg px-2 py-1 inline-block ${badgeClass}`}
        >
          {count} {label}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`text-secondary transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          aria-hidden
        >
          <path d="M6 3l5 5-5 5V3z" />
        </svg>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </section>
  );
}

function CardList<T>({
  items,
  renderItem,
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, PREVIEW_LIMIT);
  const remaining = items.length - PREVIEW_LIMIT;

  return (
    <>
      <ul className="space-y-2">
        {visible.map((item, i) => renderItem(item, i))}
      </ul>
      {!showAll && remaining > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 text-sm font-medium text-primary hover:underline cursor-pointer"
        >
          Show {remaining} more
        </button>
      )}
    </>
  );
}

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

  const contentRef = useFocusTrap(open, onClose);

  if (!open) return null;

  const newCount = diff?.newCards.length ?? 0;
  const updatedCount = diff?.updatedCards.length ?? 0;
  const removedCount = diff?.removedCards.length ?? 0;
  const totalChanges = newCount + updatedCount + removedCount;
  const onlyRemovals = diff && newCount === 0 && updatedCount === 0 && removedCount > 0;

  // Auto-expand a section only if it's the sole section with items
  const sectionCount = [newCount, updatedCount, removedCount].filter((n) => n > 0).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deck-update-diff-title"
    >
      <div
        ref={contentRef}
        className="bg-surface-card border border-border rounded-xl shadow-lg max-w-2xl w-full my-8 max-h-[90vh] flex flex-col outline-none"
        tabIndex={-1}
      >
        <div className="p-6 pb-0">
          <h2 id="deck-update-diff-title" className="text-lg font-semibold text-body">
            Deck updates
          </h2>

          {/* Summary counts */}
          {diff && !loading && totalChanges > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {newCount > 0 && (
                <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-success-bg border border-success-border text-success">
                  +{newCount} new
                </span>
              )}
              {updatedCount > 0 && (
                <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-info-bg border border-info-border text-info">
                  {updatedCount} updated
                </span>
              )}
              {removedCount > 0 && (
                <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-surface-base border border-border text-secondary">
                  {removedCount} removed
                </span>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="p-6 flex items-center gap-2 text-sm text-secondary">
            <Spinner size={20} />
            Loading changes…
          </div>
        )}

        {error && (
          <p className="mx-6 mt-4 text-sm text-error" role="alert">
            {error}
          </p>
        )}

        {diff && !loading && totalChanges === 0 && (
          <div className="p-6 text-sm text-secondary">No changes detected.</div>
        )}

        {diff && !loading && totalChanges > 0 && (
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {newCount > 0 && (
              <DiffSection
                label="New"
                count={newCount}
                badgeClass="text-success bg-success-bg border border-success-border"
                defaultOpen={sectionCount === 1}
              >
                <CardList
                  items={diff.newCards}
                  renderItem={(c: DeckDiff["newCards"][number]) => (
                    <li
                      key={c.id}
                      className="bg-surface-base border border-border rounded-lg p-3 text-sm"
                    >
                      <p className="font-medium text-body break-words">{c.front}</p>
                      <details className="mt-1">
                        <summary className="text-secondary cursor-pointer hover:text-body">
                          Show back
                        </summary>
                        <p className="mt-1 text-body whitespace-pre-wrap break-words">
                          {c.back}
                        </p>
                      </details>
                    </li>
                  )}
                />
                <p className="text-xs text-secondary mt-2">
                  These will be added with default SRS state (due now).
                </p>
              </DiffSection>
            )}

            {updatedCount > 0 && (
              <DiffSection
                label="Updated"
                count={updatedCount}
                badgeClass="text-info bg-info-bg border border-info-border"
                defaultOpen={sectionCount === 1}
              >
                <CardList
                  items={diff.updatedCards}
                  renderItem={(
                    pair: DeckDiff["updatedCards"][number]
                  ) => (
                    <li
                      key={pair.imported.id}
                      className="bg-surface-base border border-border rounded-lg p-3 text-sm"
                    >
                      <p className="text-secondary text-xs mb-1">Front:</p>
                      <p className="line-through text-muted">{pair.imported.front}</p>
                      <p className="text-body font-medium mt-1">→ {pair.source.front}</p>
                      <details className="mt-2">
                        <summary className="text-secondary cursor-pointer hover:text-body">
                          Back (before → after)
                        </summary>
                        <p className="line-through text-muted mt-1">{pair.imported.back}</p>
                        <p className="text-body mt-1">→ {pair.source.back}</p>
                      </details>
                    </li>
                  )}
                />
                <p className="text-xs text-secondary mt-2">
                  Your review progress for these cards will not be reset.
                </p>
              </DiffSection>
            )}

            {removedCount > 0 && (
              <DiffSection
                label="Removed"
                count={removedCount}
                badgeClass="text-body bg-surface-base border border-border"
                defaultOpen={sectionCount === 1}
              >
                <CardList
                  items={diff.removedCards}
                  renderItem={(c: DeckDiff["removedCards"][number]) => (
                    <li
                      key={c.id}
                      className="bg-surface-base border border-border rounded-lg p-3 text-sm"
                    >
                      <p className="text-body break-words">{c.front}</p>
                      <p className="text-xs text-secondary italic mt-1">
                        This card no longer exists in the original deck. You can delete it
                        manually.
                      </p>
                    </li>
                  )}
                />
              </DiffSection>
            )}
          </div>
        )}

        {diff && !loading && (
          <div className="flex justify-end gap-2 p-6 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card cursor-pointer"
            >
              Cancel
            </button>
            {totalChanges > 0 && (
              <button
                type="button"
                onClick={onlyRemovals ? handleApply : handleApply}
                disabled={applying}
                className="h-10 px-4 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
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

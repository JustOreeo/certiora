"use client";

import { useState } from "react";
import { toUserMessage } from "@/lib/errors";
import { useFocusTrap } from "@/hooks/useFocusTrap";

type Props = { open: boolean; onClose: () => void; onDone: (deckId: string | null) => void };

export function CreateDeckModal({ open, onClose, onDone }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setIsPublic(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const contentRef = useFocusTrap(open, handleClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Deck name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/flashcards/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || undefined,
          isPublic,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(toUserMessage(data, "Failed to create deck."));
        return;
      }
      onDone(data.id);
    } catch (err) {
      setError(toUserMessage(err, "Failed to create deck."));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="create-deck-title">
      <div ref={contentRef} className="bg-surface-card border border-border rounded-xl shadow-lg max-w-md w-full p-6 outline-none" tabIndex={-1}>
        <h2 id="create-deck-title" className="text-lg font-semibold text-body mb-4">
          Create deck
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="deck-name" className="block text-sm font-medium text-body mb-1">
              Deck name <span className="text-error">*</span>
            </label>
            <input
              id="deck-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Biology Ch. 1"
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-base text-body text-sm"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="deck-desc" className="block text-sm font-medium text-body mb-1">
              Description (optional)
            </label>
            <textarea
              id="deck-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-base text-body text-sm resize-none"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                id="deck-public"
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="deck-public" className="text-sm text-body">
                Public (visible to everyone in my organization)
              </label>
            </div>
            {isPublic && (
              <p className="mt-2 text-xs text-secondary">
                Anyone in your organization will be able to see and import this deck. Only card
                content is shared — not your progress.
              </p>
            )}
          </div>
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="min-h-[44px] px-4 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="min-h-[44px] px-4 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

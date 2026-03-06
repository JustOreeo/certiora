"use client";

import { useState, useEffect } from "react";
import { toUserMessage } from "@/lib/errors";

type Card = { id: string; front: string; back: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (card: Card | null) => void;
  deckId: string;
  /** When set, edit mode; otherwise create mode. After save in create mode, clear and stay open for next. */
  existing?: Card | null;
};

export function CardEditorModal({ open, onClose, onSaved, deckId, existing }: Props) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!existing?.id;

  useEffect(() => {
    if (open) {
      setFront(existing?.front ?? "");
      setBack(existing?.back ?? "");
      setError(null);
    }
  }, [open, existing?.id, existing?.front, existing?.back]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = front.trim();
    const b = back.trim();
    if (!f || !b) {
      setError("Front and back are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        const res = await fetch(`/api/flashcards/decks/${deckId}/cards/${existing!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ front: f, back: b }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(toUserMessage(data, "Failed to update card."));
          return;
        }
        onSaved(data);
        onClose();
      } else {
        const res = await fetch(`/api/flashcards/decks/${deckId}/cards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ front: f, back: b }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(toUserMessage(data, "Failed to add card."));
          return;
        }
        onSaved(data);
        setFront("");
        setBack("");
        // Stay open for next card (create mode)
      }
    } catch (err) {
      setError(toUserMessage(err, "Failed to save card."));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFront("");
    setBack("");
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-editor-title"
    >
      <div className="bg-surface-card border border-border rounded-xl shadow-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 id="card-editor-title" className="text-lg font-semibold text-body mb-4">
          {isEdit ? "Edit card" : "Add card"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="card-front" className="block text-sm font-medium text-body mb-1">
              Front (question or prompt) <span className="text-error">*</span>
            </label>
            <textarea
              id="card-front"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-base text-body text-sm resize-none"
              autoFocus
            />
            <p className="text-xs text-secondary mt-1">{front.length}/1000</p>
          </div>
          <div>
            <label htmlFor="card-back" className="block text-sm font-medium text-body mb-1">
              Back (answer or explanation) <span className="text-error">*</span>
            </label>
            <textarea
              id="card-back"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              maxLength={2000}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-base text-body text-sm resize-none"
            />
            <p className="text-xs text-secondary mt-1">{back.length}/2000</p>
          </div>
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="h-10 px-4 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !front.trim() || !back.trim()}
              className="h-10 px-4 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? "Saving…" : isEdit ? "Save" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

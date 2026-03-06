"use client";

import { useState, useEffect } from "react";
import { toUserMessage } from "@/lib/errors";

type Preview = {
  id: string;
  name: string;
  description: string | null;
  cardCount: number;
  creatorName: string;
  sampleFronts: string[];
};

type Props = {
  open: boolean;
  deckId: string | null;
  onClose: () => void;
  onDone: (deckId: string | null) => void;
};

export function ImportFromLibraryDialog({ open, deckId, onClose, onDone }: Props) {
  const [step, setStep] = useState<"preview" | "importing">("preview");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !deckId) {
      setPreview(null);
      setError(null);
      setStep("preview");
      return;
    }
    let cancelled = false;
    setError(null);
    fetch(`/api/flashcards/library/${deckId}`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setPreview(null);
          return;
        }
        setPreview(data);
      })
      .catch((err) => {
        if (!cancelled) setError(toUserMessage(err, "Failed to load preview."));
      });
    return () => {
      cancelled = true;
    };
  }, [open, deckId]);

  const handleImport = async () => {
    if (!deckId || !preview) return;
    setStep("importing");
    setError(null);
    try {
      const res = await fetch("/api/flashcards/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Import failed.");
        setStep("preview");
        return;
      }
      onDone(data.id);
    } catch (err) {
      setError(toUserMessage(err, "Import failed."));
      setStep("preview");
    }
  };

  const handleClose = () => {
    setPreview(null);
    setError(null);
    setStep("preview");
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-library-deck-title"
    >
      <div className="bg-surface-card border border-border rounded-xl shadow-lg max-w-md w-full p-6">
        <h2 id="import-library-deck-title" className="text-lg font-semibold text-body mb-4">
          {step === "preview" ? "Import from library" : "Importing…"}
        </h2>

        {step === "preview" && (
          <>
            {error && (
              <p className="text-sm text-error mb-4" role="alert">
                {error}
              </p>
            )}
            {preview && !error && (
              <div className="space-y-2 mb-4">
                <p className="font-medium text-body">{preview.name}</p>
                {preview.description && (
                  <p className="text-sm text-secondary line-clamp-2">{preview.description}</p>
                )}
                <p className="text-sm text-secondary">
                  {preview.cardCount} cards · by {preview.creatorName}
                </p>
                {preview.sampleFronts.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-secondary mb-1">Sample cards:</p>
                    <ul className="text-sm text-body list-disc list-inside space-y-0.5">
                      {preview.sampleFronts.map((front, i) => (
                        <li key={i} className="truncate">
                          {front.slice(0, 60)}
                          {front.length > 60 ? "…" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {!preview && !error && (
              <div className="flex items-center gap-2 text-sm text-secondary py-4">
                <svg
                  className="animate-spin"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeOpacity="0.25"
                  />
                  <path
                    d="M4 12a8 8 0 018-8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Loading…
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="h-10 px-4 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!preview}
                className="h-10 px-4 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover disabled:opacity-50"
              >
                Import {preview ? `${preview.cardCount} cards` : "…"}
              </button>
            </div>
          </>
        )}

        {step === "importing" && (
          <div className="flex items-center gap-2 text-sm text-secondary">
            <svg
              className="animate-spin"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
                strokeOpacity="0.25"
              />
              <path
                d="M4 12a8 8 0 018-8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Importing deck…
          </div>
        )}
      </div>
    </div>
  );
}

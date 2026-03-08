"use client";

import { useState } from "react";
import { toUserMessage } from "@/lib/errors";
import { useFocusTrap } from "@/hooks/useFocusTrap";

type Preview = {
  id: string;
  name: string;
  description: string | null;
  cardCount: number;
  creatorName: string;
  sampleFronts: string[];
  alreadyImported?: boolean;
};

type Props = { open: boolean; onClose: () => void; onDone: (deckId: string | null) => void };

export function ImportDeckDialog({ open, onClose, onDone }: Props) {
  const [shareCode, setShareCode] = useState("");
  const [step, setStep] = useState<"input" | "preview" | "importing">("input");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  const reset = () => {
    setShareCode("");
    setStep("input");
    setPreview(null);
    setError(null);
    setConfirmDuplicate(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const contentRef = useFocusTrap(open, handleClose);

  const normalizeShareCode = (code: string) =>
    code.trim().toUpperCase().replace(/\s/g, "");

  const handlePreview = async () => {
    const code = normalizeShareCode(shareCode);
    if (!code) {
      setError("Enter a share code.");
      return;
    }
    setError(null);
    setConfirmDuplicate(false);
    try {
      const res = await fetch(`/api/flashcards/preview?shareCode=${encodeURIComponent(code)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "This share code doesn't exist or has expired.");
        setPreview(null);
        return;
      }
      setPreview(data);
      setStep("preview");
    } catch (err) {
      setError(toUserMessage(err, "Failed to load preview."));
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    if (preview.alreadyImported && !confirmDuplicate) {
      setError("Confirm that you want to create a duplicate copy.");
      return;
    }
    setStep("importing");
    setError(null);
    try {
      const res = await fetch("/api/flashcards/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareCode: normalizeShareCode(shareCode) }),
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-deck-title"
    >
      <div
        ref={contentRef}
        className="bg-surface-card border border-border rounded-xl shadow-lg max-w-md w-full p-6 outline-none"
        tabIndex={-1}
      >
        <h2 id="import-deck-title" className="text-lg font-semibold text-body mb-4">
          {step === "input" ? "Import deck" : step === "preview" ? "Preview" : "Importing…"}
        </h2>

        {step === "input" && (
          <>
            <label htmlFor="import-share-code" className="block text-sm font-medium text-body mb-1">
              Enter share code
            </label>
            <input
              id="import-share-code"
              type="text"
              value={shareCode}
              onChange={(e) => setShareCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-base text-body font-mono text-sm mb-4"
              autoFocus
            />
            {error && (
              <p className="text-sm text-error mb-4" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="h-10 px-4 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePreview}
                className="h-10 px-4 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover"
              >
                Preview
              </button>
            </div>
          </>
        )}

        {step === "preview" && preview && (
          <>
            <div className="space-y-2 mb-4">
              {preview.alreadyImported && (
                <div className="rounded-lg border border-warning-border bg-warning-bg px-3 py-2 mb-3">
                  <p className="text-sm text-warning font-medium">
                    You&apos;ve already imported this deck. This will create a duplicate copy.
                  </p>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmDuplicate}
                      onChange={(e) => setConfirmDuplicate(e.target.checked)}
                      className="rounded border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      aria-describedby="duplicate-import-warning"
                    />
                    <span id="duplicate-import-warning" className="text-sm text-body">
                      I want to import again
                    </span>
                  </label>
                </div>
              )}
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
            {error && (
              <p className="text-sm text-error mb-4" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep("input")}
                className="h-10 px-4 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={preview.alreadyImported && !confirmDuplicate}
                className="h-10 px-4 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover disabled:opacity-50"
              >
                Import {preview.cardCount} cards
              </button>
            </div>
          </>
        )}

        {step === "importing" && (
          <div className="flex items-center gap-2 text-sm text-secondary">
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Importing deck…
          </div>
        )}
      </div>
    </div>
  );
}

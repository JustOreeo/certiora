"use client";

import { useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

type ParsedCard = { front: string; back: string; valid: boolean; error?: string };

function parseText(text: string): ParsedCard[] {
  const lines = text.split("\n").filter((l) => l.trim());
  return lines.map((line) => {
    // Try tab separator first, then ||
    const sep = line.includes("\t") ? "\t" : "||";
    const parts = line.split(sep);
    if (parts.length < 2) {
      return { front: line.trim(), back: "", valid: false, error: "Missing separator (tab or ||)" };
    }
    const front = parts[0].trim().slice(0, 1000);
    const back = parts.slice(1).join(sep).trim().slice(0, 2000);
    if (!front || !back) {
      return { front, back, valid: false, error: "Front and back are required" };
    }
    return { front, back, valid: true };
  });
}

export function BulkCardEditor({
  open,
  deckId,
  onClose,
  onDone,
}: {
  open: boolean;
  deckId: string;
  onClose: () => void;
  onDone: (created: number) => void;
}) {
  const [mode, setMode] = useState<"paste" | "form">("paste");
  const [pasteText, setPasteText] = useState("");
  const [formRows, setFormRows] = useState<Array<{ front: string; back: string }>>([
    { front: "", back: "" },
    { front: "", back: "" },
    { front: "", back: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; errors: Array<{ index: number; error: string }> } | null>(null);
  const ref = useFocusTrap<HTMLDivElement>(open, onClose);

  if (!open) return null;

  const parsedCards = mode === "paste" ? parseText(pasteText) : [];
  const validParsedCount = parsedCards.filter((c) => c.valid).length;

  const formCards = formRows.filter((r) => r.front.trim() && r.back.trim());

  const addFormRow = () => {
    setFormRows((rows) => [...rows, { front: "", back: "" }]);
  };

  const updateFormRow = (index: number, field: "front" | "back", value: string) => {
    setFormRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const removeFormRow = (index: number) => {
    setFormRows((rows) => rows.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError(null);
    setResult(null);
    setSaving(true);

    const cards =
      mode === "paste"
        ? parsedCards.filter((c) => c.valid).map((c) => ({ front: c.front, back: c.back }))
        : formCards.map((r) => ({ front: r.front.trim(), back: r.back.trim() }));

    if (cards.length === 0) {
      setError("No valid cards to add");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}/cards/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create cards");
        setSaving(false);
        return;
      }
      setResult(data);
      if (data.created > 0) {
        setTimeout(() => onDone(data.created), 1500);
      }
    } catch {
      setError("Failed to create cards");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" aria-modal="true">
      <div ref={ref} className="bg-surface-card border border-border rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-body">Bulk Add Cards</h2>
          <button type="button" onClick={onClose} className="text-secondary hover:text-body text-xl leading-none">
            &times;
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${mode === "paste" ? "bg-primary text-inverse" : "border border-border bg-surface-base text-body"}`}
          >
            Paste
          </button>
          <button
            type="button"
            onClick={() => setMode("form")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${mode === "form" ? "bg-primary text-inverse" : "border border-border bg-surface-base text-body"}`}
          >
            Form
          </button>
        </div>

        {mode === "paste" && (
          <div className="space-y-3">
            <p className="text-xs text-secondary">
              One card per line. Separate front and back with a <strong>tab</strong> or <code>||</code>.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"What is photosynthesis?\tThe process by which plants convert sunlight to energy\nMitochondria function\tPowerhouse of the cell"}
              rows={8}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface-base text-body text-sm font-mono resize-y"
            />
            {parsedCards.length > 0 && (
              <p className="text-xs text-secondary">
                {validParsedCount} valid card{validParsedCount !== 1 ? "s" : ""} found
                {parsedCards.filter((c) => !c.valid).length > 0 && (
                  <span className="text-error">
                    {" "}({parsedCards.filter((c) => !c.valid).length} with errors)
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {mode === "form" && (
          <div className="space-y-3">
            {formRows.map((row, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  type="text"
                  value={row.front}
                  onChange={(e) => updateFormRow(i, "front", e.target.value)}
                  placeholder="Front"
                  maxLength={1000}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface-base text-body text-sm"
                />
                <input
                  type="text"
                  value={row.back}
                  onChange={(e) => updateFormRow(i, "back", e.target.value)}
                  placeholder="Back"
                  maxLength={2000}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface-base text-body text-sm"
                />
                {formRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFormRow(i)}
                    className="text-secondary hover:text-error text-lg leading-none px-1"
                    aria-label="Remove row"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addFormRow}
              className="text-sm text-primary hover:underline"
            >
              + Add row
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm text-error mt-3" role="alert">{error}</p>
        )}

        {result && (
          <p className="text-sm text-success mt-3" role="status">
            {result.created} card{result.created !== 1 ? "s" : ""} added
            {result.errors.length > 0 && `, ${result.errors.length} skipped`}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || (mode === "paste" ? validParsedCount === 0 : formCards.length === 0)}
            className="h-10 px-4 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover disabled:opacity-50"
          >
            {saving
              ? "Adding…"
              : `Add ${mode === "paste" ? validParsedCount : formCards.length} card${(mode === "paste" ? validParsedCount : formCards.length) !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

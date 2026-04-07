"use client";

import { useState, useRef } from "react";

type ParsedRow = { front: string; back: string };
type ImportError = { row: number; error: string };

interface CsvImportDialogProps {
  open: boolean;
  deckId: string;
  onClose: () => void;
  onDone: (created: number) => void;
}

export function CsvImportDialog({ open, deckId, onClose, onDone }: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultErrors, setResultErrors] = useState<ImportError[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setPreview([]);
    setError(null);
    setResultErrors([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = async (f: File | null) => {
    setError(null);
    setResultErrors([]);
    setPreview([]);
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.name.endsWith(".csv")) {
      setError("Please select a .csv file");
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setError("File too large (max 2 MB)");
      return;
    }
    setFile(f);

    // Client-side preview
    try {
      const text = await f.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        setError("CSV must have a header row and at least one data row");
        return;
      }
      const header = lines[0].toLowerCase();
      if (!header.includes("front") || !header.includes("back")) {
        setError('CSV must have "front" and "back" columns');
        return;
      }
      // Simple CSV parse for preview (papaparse runs server-side for actual import)
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const frontIdx = headers.findIndex((h) => h.toLowerCase() === "front");
      const backIdx = headers.findIndex((h) => h.toLowerCase() === "back");
      const rows: ParsedRow[] = [];
      for (let i = 1; i < Math.min(lines.length, 11); i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        rows.push({ front: cols[frontIdx] || "", back: cols[backIdx] || "" });
      }
      setPreview(rows);
    } catch {
      setError("Failed to read file");
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);
    setResultErrors([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/flashcards/decks/${deckId}/import-csv`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
        if (data.parseErrors) setResultErrors(data.parseErrors);
        return;
      }
      if (data.errors?.length > 0) {
        setResultErrors(data.errors);
      }
      onDone(data.created ?? 0);
      reset();
    } catch {
      setError("Network error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface-card border border-border rounded-xl shadow-lg w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-body">Import CSV</h2>
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            className="text-secondary hover:text-body text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <p className="text-sm text-secondary mb-3">
          Upload a CSV file with <code className="text-xs bg-surface-base px-1 py-0.5 rounded">front</code> and{" "}
          <code className="text-xs bg-surface-base px-1 py-0.5 rounded">back</code> columns. Max 500 cards per import.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-body file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface-base file:px-3 file:py-2 file:text-sm file:font-medium file:text-body hover:file:bg-surface-card"
        />

        {error && (
          <p className="mt-3 text-sm text-error">{error}</p>
        )}

        {preview.length > 0 && (
          <div className="mt-4 max-h-48 overflow-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-base border-b border-border">
                  <th className="text-left px-3 py-2 text-secondary font-medium">Front</th>
                  <th className="text-left px-3 py-2 text-secondary font-medium">Back</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-body truncate max-w-[200px]">{row.front}</td>
                    <td className="px-3 py-2 text-body truncate max-w-[200px]">{row.back}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length === 10 && (
              <p className="text-xs text-secondary px-3 py-1">Showing first 10 rows...</p>
            )}
          </div>
        )}

        {resultErrors.length > 0 && (
          <div className="mt-3 max-h-32 overflow-auto text-sm">
            <p className="font-medium text-secondary mb-1">Skipped rows:</p>
            {resultErrors.map((e, i) => (
              <p key={i} className="text-error text-xs">Row {e.row}: {e.error}</p>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            className="h-10 px-4 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!file || importing}
            onClick={handleImport}
            className="h-10 px-4 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

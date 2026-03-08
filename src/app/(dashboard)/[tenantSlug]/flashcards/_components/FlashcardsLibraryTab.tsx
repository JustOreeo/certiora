"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SourceBadge } from "./SourceBadge";
import { ImportFromLibraryDialog } from "./ImportFromLibraryDialog";

export type LibraryDeckItem = {
  id: string;
  name: string;
  description: string | null;
  source: "PERSONAL" | "SHARED" | "ADMIN_SEEDED" | "EXAM_GENERATED" | null;
  cardCount: number;
  creatorName: string;
  importCount: number;
  isOwn: boolean;
  alreadyImported: boolean;
};

const SORT_OPTIONS: { value: "newest" | "most_imported" | "az"; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "most_imported", label: "Most imported" },
  { value: "az", label: "A–Z" },
];

const SOURCE_FILTERS: { value: "" | "ADMIN_SEEDED" | "student"; label: string }[] = [
  { value: "", label: "All" },
  { value: "ADMIN_SEEDED", label: "From review center" },
  { value: "student", label: "Student decks" },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function FlashcardsLibraryTab({
  tenantSlug,
  onNavigateToDecks,
}: {
  tenantSlug: string;
  onNavigateToDecks?: () => void;
}) {
  const [decks, setDecks] = useState<LibraryDeckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState<"newest" | "most_imported" | "az">("newest");
  const [sourceFilter, setSourceFilter] = useState<"" | "ADMIN_SEEDED" | "student">("");
  const [importDialogDeckId, setImportDialogDeckId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchInput.trim(), 300);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("sort", sort);
      if (sourceFilter) params.set("source", sourceFilter);
      const res = await fetch(`/api/flashcards/library?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load library");
      const data = await res.json();
      setDecks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setDecks([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sort, sourceFilter]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const handleImportDone = (deckId: string | null) => {
    setImportDialogDeckId(null);
    if (deckId) loadLibrary();
    if (deckId) window.location.href = `/${tenantSlug}/flashcards/decks/${deckId}`;
  };

  const hasFilters = debouncedSearch || sourceFilter;
  const emptyNoDecks = !loading && decks.length === 0 && !hasFilters;
  const emptySearch = !loading && decks.length === 0 && hasFilters;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search deck name or description…"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-surface-base text-body text-sm"
          aria-label="Search library"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "newest" | "most_imported" | "az")}
          className="px-3 py-2 rounded-lg border border-border bg-surface-base text-body text-sm"
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by source">
        {SOURCE_FILTERS.map((f) => (
          <button
            key={f.value || "all"}
            type="button"
            onClick={() => setSourceFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              sourceFilter === f.value
                ? "bg-primary text-inverse"
                : "border border-border bg-surface-card text-body hover:bg-surface-base"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}

      {emptyNoDecks && (
        <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-secondary">
            No public decks yet. Be the first to share a deck with your batch.
          </p>
          {onNavigateToDecks ? (
            <button
              type="button"
              onClick={onNavigateToDecks}
              className="inline-flex mt-4 h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
            >
              Create a deck
            </button>
          ) : (
            <Link
              href={`/${tenantSlug}/flashcards`}
              className="inline-flex mt-4 h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
            >
              Create a deck
            </Link>
          )}
        </div>
      )}

      {emptySearch && (
        <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-secondary">No decks match your search.</p>
        </div>
      )}

      {!loading && decks.length > 0 && (
        <ul
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          role="list"
        >
          {decks.map((deck) => (
            <li
              key={deck.id}
              className={`flex flex-col rounded-2xl p-5 border transition-all duration-150 ${
                deck.isOwn
                  ? "bg-surface-card border-2 border-primary shadow-sm"
                  : "bg-surface-card border border-border hover:shadow-md hover:-translate-y-0.5"
              }`}
            >
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                <div className="flex flex-wrap items-start gap-2">
                  <h3 className="font-medium text-body truncate flex-1 min-w-0" title={deck.name}>
                    {deck.name}
                  </h3>
                  <SourceBadge source={deck.source} />
                </div>
                {deck.description && (
                  <p className="text-sm text-secondary line-clamp-2 flex-shrink-0">
                    {deck.description}
                  </p>
                )}
                <div className="text-xs text-secondary space-y-0.5">
                  <p>
                    {deck.cardCount} cards · {deck.creatorName}
                  </p>
                  <p className="text-muted">↓ {deck.importCount} imports</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border">
                {deck.isOwn ? (
                  <Link
                    href={`/${tenantSlug}/flashcards/decks/${deck.id}`}
                    className="inline-flex w-full justify-center items-center gap-1 h-10 px-4 rounded-lg text-sm font-medium border border-primary text-primary bg-primary-subtle hover:bg-primary/10 transition-colors"
                  >
                    Edit →
                  </Link>
                ) : deck.alreadyImported ? (
                  <p className="flex items-center justify-center gap-1 text-sm font-medium text-success py-2">
                    <span aria-hidden>✓</span> Imported
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setImportDialogDeckId(deck.id)}
                    className="w-full h-10 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
                  >
                    Import
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ImportFromLibraryDialog
        open={!!importDialogDeckId}
        deckId={importDialogDeckId}
        onClose={() => setImportDialogDeckId(null)}
        onDone={handleImportDone}
      />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toUserMessage } from "@/lib/errors";
import { SourceBadge } from "./SourceBadge";
import { CreateDeckModal } from "./CreateDeckModal";
import { ImportDeckDialog } from "./ImportDeckDialog";

export type DeckListItem = {
  id: string;
  name: string;
  description: string | null;
  source: "PERSONAL" | "SHARED" | "ADMIN_SEEDED" | "EXAM_GENERATED" | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED" | null;
  isPublic: boolean;
  version: number;
  sourceDeckId: string | null;
  importedAtVersion: number | null;
  shareCode: string | null;
  shareCodeCreatedAt: string | null;
  retentionTarget: number | null;
  suggestedRetentionTarget: number | null;
  createdAt: string;
  updatedAt: string;
  cardCount: number;
  dueToday: number;
};

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function FlashcardsMyDecksTab({ tenantSlug }: { tenantSlug: string }) {
  const [decks, setDecks] = useState<DeckListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDecks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/flashcards/decks");
      if (!res.ok) throw new Error("Failed to load decks");
      const data = await res.json();
      setDecks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setDecks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDecks();
  }, []);

  const handleCreateDone = (deckId: string | null) => {
    setCreateOpen(false);
    if (deckId) loadDecks();
    if (deckId) window.location.href = `/${tenantSlug}/flashcards/decks/${deckId}`;
  };

  const handleImportDone = (deckId: string | null) => {
    setImportOpen(false);
    if (deckId) {
      loadDecks();
      window.location.href = `/${tenantSlug}/flashcards/decks/${deckId}`;
    }
  };

  const handleDelete = async (deck: DeckListItem) => {
    if (deck.source === "EXAM_GENERATED") return;
    const msg = `Delete ${deck.name}? This will permanently delete all ${deck.cardCount} cards and your review progress for this deck.`;
    if (!confirm(msg)) return;
    setDeletingId(deck.id);
    try {
      const res = await fetch(`/api/flashcards/decks/${deck.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(toUserMessage(data, "Failed to delete deck."));
        return;
      }
      setDecks((prev) => prev.filter((d) => d.id !== deck.id));
    } catch (e) {
      alert(toUserMessage(e, "Failed to delete deck."));
    } finally {
      setDeletingId(null);
    }
  };

  const canDelete = (d: DeckListItem) => d.source !== "EXAM_GENERATED";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-10 items-center px-4 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
        >
          New Deck
        </button>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex h-10 items-center px-4 rounded-lg text-sm font-medium border border-border bg-surface-card hover:bg-surface-base transition-colors"
        >
          Import Deck
        </button>
      </div>

      {decks.length === 0 && (
        <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-secondary">
            You haven&apos;t created any custom decks yet. Create a deck to start studying your own
            notes.
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex mt-4 h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
          >
            Create your first deck
          </button>
        </div>
      )}

      {decks.length > 0 && (
        <ul className="space-y-3">
          {decks.map((deck) => (
            <li
              key={deck.id}
              className="bg-surface-card border border-border rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Link
                    href={`/${tenantSlug}/flashcards/decks/${deck.id}`}
                    className="font-medium text-body hover:underline truncate"
                  >
                    {deck.name}
                  </Link>
                  <SourceBadge source={deck.source} />
                  <span className="text-xs text-secondary">
                    {deck.isPublic ? (
                      <span className="inline-flex items-center gap-1">Public</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">Private</span>
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-secondary">
                  <span>{deck.cardCount} cards</span>
                  {deck.dueToday > 0 && (
                    <span className="font-medium text-primary">{deck.dueToday} due today</span>
                  )}
                  {deck.shareCode ? (
                    <span className="font-mono">{deck.shareCode}</span>
                  ) : (
                    <span>No share code</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/${tenantSlug}/flashcards/decks/${deck.id}`}
                  className="inline-flex h-9 items-center px-3 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card"
                >
                  Edit
                </Link>
                <Link
                  href={`/${tenantSlug}/flashcards/decks/${deck.id}#share`}
                  className="inline-flex h-9 items-center px-3 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card"
                >
                  Share
                </Link>
                {canDelete(deck) && (
                  <button
                    type="button"
                    disabled={deletingId === deck.id}
                    onClick={() => handleDelete(deck)}
                    className="inline-flex h-9 items-center px-3 rounded-lg text-sm font-medium border border-error/30 text-error hover:bg-error/10 disabled:opacity-50"
                  >
                    {deletingId === deck.id ? "…" : "Delete"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateDeckModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={handleCreateDone} />
      <ImportDeckDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={handleImportDone} />
    </div>
  );
}

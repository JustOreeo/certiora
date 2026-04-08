"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toUserMessage } from "@/lib/errors";
import { SourceBadge } from "./SourceBadge";
import { CreateDeckModal } from "./CreateDeckModal";
import { ImportDeckDialog } from "./ImportDeckDialog";
import { Spinner } from "@/components/ui/Spinner";

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5v2h-1a1.5 1.5 0 0 0-1.5 1.5v6a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5h-1v-2A3.5 3.5 0 0 0 8 1zm2 5.5v-2a2 2 0 1 0-4 0v2h4z" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM1.5 8a6.5 6.5 0 0 0 11.99 4.5H8.5v-1h4.99A6.5 6.5 0 0 0 1.5 8zm6.5 6.5v-1h4.99a6.5 6.5 0 0 1-4.99 4.5zM8.5 7.5V6.5h4.99a6.5 6.5 0 0 0 0 2H8.5z" />
    </svg>
  );
}

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


export function FlashcardsMyDecksTab({ tenantSlug }: { tenantSlug: string }) {
  const [decks, setDecks] = useState<DeckListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pageSize = 20;

  const loadDecks = async (p = page) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/flashcards/decks?page=${p}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error("Failed to load decks");
      const data = await res.json();
      setDecks(data.items ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? 1);
    } catch (e) {
      console.error(e);
      setDecks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDecks(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          {decks.map((deck, i) => (
            <li
              key={deck.id}
              className={`bg-surface-card border rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3 transition-all duration-200 hover:shadow-lg hover:border-primary/30 cursor-pointer anim-stagger ${
                deck.dueToday > 0 ? "border-l-4 border-l-primary border-border" : "border-border"
              }`}
              style={{ animationDelay: `${Math.min(i, 9) * 40}ms` }}
            >
              {/* Deck color avatar */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-inverse font-bold text-sm shrink-0"
                style={{
                  backgroundColor: [
                    "#4B4EFC", "#676AFF", "#8D90FF", "#3D40E3", "#2F32C9", "#B3B5FF"
                  ][deck.id.charCodeAt(0) % 6],
                }}
              >
                {deck.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Link
                    href={`/${tenantSlug}/flashcards/decks/${deck.id}`}
                    className="font-medium text-body hover:text-primary truncate transition-colors"
                  >
                    {deck.name}
                  </Link>
                  <SourceBadge source={deck.source} />
                  <span className="text-xs text-secondary inline-flex items-center gap-1">
                    {deck.isPublic ? (
                      <>
                        <GlobeIcon className="w-3.5 h-3.5" aria-hidden />
                        Public
                      </>
                    ) : (
                      <>
                        <LockIcon className="w-3.5 h-3.5" aria-hidden />
                        Private
                      </>
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-secondary">
                  <span>{deck.cardCount} cards</span>
                  {deck.dueToday > 0 ? (
                    <span className="font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">
                      {deck.dueToday} due today
                    </span>
                  ) : (
                    <span className="text-muted">No cards due</span>
                  )}
                  {deck.shareCode ? (
                    <span className="font-mono">{deck.shareCode}</span>
                  ) : (
                    <span>No share code</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {deck.dueToday > 0 && (
                  <Link
                    href={`/${tenantSlug}/flashcards/study?deckId=${deck.id}`}
                    className="inline-flex h-9 items-center gap-1.5 px-3 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
                  >
                    Study
                    <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-[11px]">
                      {deck.dueToday}
                    </span>
                  </Link>
                )}
                {deck.cardCount > 0 && (
                  <Link
                    href={`/${tenantSlug}/flashcards/study?deckId=${deck.id}&mode=cram`}
                    className="inline-flex h-9 items-center px-3 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card transition-colors"
                  >
                    Cram
                  </Link>
                )}
                <Link
                  href={`/${tenantSlug}/flashcards/decks/${deck.id}`}
                  className="inline-flex h-9 items-center px-3 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card transition-colors"
                >
                  Manage
                </Link>
                {canDelete(deck) && (
                  <button
                    type="button"
                    disabled={deletingId === deck.id}
                    onClick={() => handleDelete(deck)}
                    className="inline-flex h-9 items-center px-3 rounded-lg text-sm font-medium border border-error/30 text-error hover:bg-error/10 disabled:opacity-50 transition-colors"
                  >
                    {deletingId === deck.id ? "..." : "Delete"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-secondary">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => loadDecks(page - 1)}
              className="inline-flex h-10 items-center px-4 rounded-lg text-xs font-medium border border-border bg-surface-card hover:bg-surface-base disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page * pageSize >= total}
              onClick={() => loadDecks(page + 1)}
              className="inline-flex h-10 items-center px-4 rounded-lg text-xs font-medium border border-border bg-surface-card hover:bg-surface-base disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <CreateDeckModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={handleCreateDone} />
      <ImportDeckDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={handleImportDone} />
    </div>
  );
}

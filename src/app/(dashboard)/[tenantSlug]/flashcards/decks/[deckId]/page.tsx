"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toUserMessage } from "@/lib/errors";
import { SourceBadge } from "../../_components/SourceBadge";
import { CardEditorModal } from "../../_components/CardEditorModal";

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

type Card = { id: string; front: string; back: string; order: number };
type Deck = {
  id: string;
  name: string;
  description: string | null;
  source: "PERSONAL" | "SHARED" | "ADMIN_SEEDED" | "EXAM_GENERATED" | null;
  isPublic: boolean;
  shareCode: string | null;
  shareCodeCreatedAt: string | null;
  cards: Card[];
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

export default function DeckDetailPage() {
  const params = useParams<{ tenantSlug: string; deckId: string }>();
  const router = useRouter();
  const tenantSlug = params?.tenantSlug ?? "";
  const deckId = params?.deckId ?? "";

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  const loadDeck = useCallback(async () => {
    if (!deckId) return;
    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}`);
      if (res.status === 404) {
        setDeck(null);
        return;
      }
      if (!res.ok) throw new Error("Failed to load deck");
      const data = await res.json();
      setDeck(data);
    } catch (e) {
      console.error(e);
      setDeck(null);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  const handleAddCard = () => {
    setEditingCard(null);
    setEditorOpen(true);
  };

  const handleEditCard = (card: Card) => {
    setEditingCard(card);
    setEditorOpen(true);
  };

  const handleCardSaved = (saved: { id: string; front: string; back: string } | null) => {
    if (saved) loadDeck();
    if (editingCard) {
      setEditorOpen(false);
      setEditingCard(null);
    }
  };

  const handleDeleteCard = async (card: Card) => {
    if (!confirm("Delete this card?")) return;
    setDeletingCardId(card.id);
    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}/cards/${card.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(toUserMessage(data, "Failed to delete card."));
        return;
      }
      setDeck((d) =>
        d ? { ...d, cards: d.cards.filter((c) => c.id !== card.id), cardCount: d.cardCount - 1 } : null
      );
    } catch (e) {
      alert(toUserMessage(e, "Failed to delete card."));
    } finally {
      setDeletingCardId(null);
    }
  };

  const handleGenerateShare = async () => {
    setShareLoading(true);
    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}/share`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate share code");
      const data = await res.json();
      setDeck((d) => (d ? { ...d, shareCode: data.shareCode, shareCodeCreatedAt: data.shareCodeCreatedAt } : null));
    } catch (e) {
      alert(toUserMessage(e, "Failed to generate share code."));
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeShare = async () => {
    if (!confirm("Revoke share code? New imports will no longer work. Existing imports are unchanged.")) return;
    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}/share`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke");
      setDeck((d) => (d ? { ...d, shareCode: null, shareCodeCreatedAt: null } : null));
    } catch (e) {
      alert(toUserMessage(e, "Failed to revoke share code."));
    }
  };

  const handleCopyCode = () => {
    if (!deck?.shareCode) return;
    navigator.clipboard.writeText(deck.shareCode);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const togglePublic = async () => {
    if (!deck || deck.source === "ADMIN_SEEDED") return;
    const next = !deck.isPublic;
    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setDeck((d) => (d ? { ...d, isPublic: next } : null));
    } catch (e) {
      alert(toUserMessage(e, "Failed to update visibility."));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="px-4 sm:px-6 md:px-8 py-6 max-w-4xl mx-auto">
        <p className="text-secondary">Deck not found.</p>
        <Link href={`/${tenantSlug}/flashcards`} className="text-primary hover:underline mt-2 inline-block">
          Back to Flashcards
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/${tenantSlug}/flashcards`}
          className="text-sm text-secondary hover:text-body mb-2 inline-block"
        >
          ← Flashcards
        </Link>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="text-xl font-semibold text-body">{deck.name}</h1>
          <SourceBadge source={deck.source} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-secondary mb-2">
          <span>{deck.cardCount} cards</span>
          {deck.dueToday > 0 && (
            <span className="font-medium text-primary">{deck.dueToday} due today</span>
          )}
        </div>
        {deck.description && (
          <p className="text-sm text-secondary mb-4">{deck.description}</p>
        )}

        {deck.source !== "ADMIN_SEEDED" && (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePublic}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-border bg-surface-base hover:bg-surface-card"
                aria-pressed={deck.isPublic}
              >
                {deck.isPublic ? (
                  <>
                    <GlobeIcon className="w-4 h-4" aria-hidden />
                    Public
                  </>
                ) : (
                  <>
                    <LockIcon className="w-4 h-4" aria-hidden />
                    Private
                  </>
                )}
              </button>
            </div>
            {deck.isPublic && (
              <p className="mt-2 text-xs text-secondary">
                Anyone in your organization will be able to see and import this deck. Only card
                content is shared — not your progress.
              </p>
            )}
          </div>
        )}

        <div id="share" className="bg-surface-base border border-border rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-body mb-2">Share this deck</h3>
          {deck.shareCode ? (
            <div>
              <p className="text-sm text-secondary mb-2">
                Anyone in this organization can use this code to import a copy of your deck. Your
                progress is not shared — only the card content.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="px-3 py-2 rounded bg-surface-card border border-border font-mono text-body">
                  {deck.shareCode}
                </code>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="h-9 px-3 rounded-lg text-sm font-medium border border-border bg-surface-card hover:bg-surface-base"
                >
                  {copyFeedback ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={handleRevokeShare}
                  className="h-9 px-3 rounded-lg text-sm font-medium text-error border border-error/30 hover:bg-error/10"
                >
                  Revoke
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-secondary mb-2">
                Share this deck with other students. Generate a share code to let them import it.
              </p>
              <button
                type="button"
                disabled={shareLoading}
                onClick={handleGenerateShare}
                className="h-9 px-3 rounded-lg text-sm font-medium border border-border bg-surface-card hover:bg-surface-base disabled:opacity-50"
              >
                {shareLoading ? "Generating…" : "Generate share code"}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-body">Cards</h2>
          <button
            type="button"
            onClick={handleAddCard}
            className="h-10 px-4 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover"
          >
            Add Card
          </button>
        </div>
      </div>

      {deck.cards.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-secondary">No cards yet. Add your first card to start building this deck.</p>
          <button
            type="button"
            onClick={handleAddCard}
            className="inline-flex mt-4 h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover"
          >
            Add card
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {deck.cards.map((card) => (
            <li
              key={card.id}
              className="bg-surface-card border border-border rounded-xl p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-body break-words">
                    {card.front.length > 120 ? `${card.front.slice(0, 120)}…` : card.front}
                  </p>
                  <details className="mt-2">
                    <summary className="text-sm text-secondary cursor-pointer hover:text-body">
                      Show back
                    </summary>
                    <p className="mt-2 text-sm text-body whitespace-pre-wrap break-words">
                      {card.back}
                    </p>
                  </details>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditCard(card)}
                    className="h-9 px-3 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={deletingCardId === card.id}
                    onClick={() => handleDeleteCard(card)}
                    className="h-9 px-3 rounded-lg text-sm font-medium text-error border border-error/30 hover:bg-error/10 disabled:opacity-50"
                  >
                    {deletingCardId === card.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CardEditorModal
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingCard(null);
        }}
        onSaved={handleCardSaved}
        deckId={deckId}
        existing={editingCard}
      />
    </div>
  );
}

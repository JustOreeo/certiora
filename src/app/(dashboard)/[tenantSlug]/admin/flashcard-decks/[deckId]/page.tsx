"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toUserMessage } from "@/lib/errors";

type Card = { id: string; front: string; back: string; order: number };
type Deck = {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  version: number;
  suggestedRetentionTarget: number | null;
  cards: Card[];
  cardCount: number;
  studentsReached: number;
  pendingUpdate: number;
};

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function StatusBadge({ status }: { status: Deck["status"] }) {
  const map: Record<Deck["status"], { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-surface-base text-secondary border-border" },
    ACTIVE: { label: "Active", className: "bg-success-bg text-success border-success-border" },
    ARCHIVED: { label: "Archived", className: "bg-surface-base text-muted border-border" },
  };
  const cfg = map[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

const TRUNCATE_LEN = 80;
function truncate(s: string, len = TRUNCATE_LEN) {
  if (s.length <= len) return s;
  return s.slice(0, len) + "…";
}

export default function AdminFlashcardDeckDetailPage() {
  const params = useParams<{ tenantSlug: string; deckId: string }>();
  const router = useRouter();
  const tenantSlug = params?.tenantSlug ?? "";
  const deckId = params?.deckId ?? "";

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [cardFront, setCardFront] = useState("");
  const [cardBack, setCardBack] = useState("");
  const [cardSaving, setCardSaving] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<
    "publish" | "archive" | "reactivate" | "delete" | null
  >(null);

  const baseUrl = `/api/${tenantSlug}/admin/flashcard-decks/${deckId}`;

  const loadDeck = useCallback(async () => {
    if (!tenantSlug || !deckId) return;
    try {
      const res = await fetch(baseUrl);
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
  }, [tenantSlug, deckId, baseUrl]);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  const openAddCard = () => {
    setEditingCard(null);
    setCardFront("");
    setCardBack("");
    setCardError(null);
    setEditorOpen(true);
  };

  const openEditCard = (card: Card) => {
    setEditingCard(card);
    setCardFront(card.front);
    setCardBack(card.back);
    setCardError(null);
    setEditorOpen(true);
  };

  const saveCard = async () => {
    const front = cardFront.trim();
    const back = cardBack.trim();
    if (!front || !back) {
      setCardError("Front and back are required.");
      return;
    }
    setCardSaving(true);
    setCardError(null);
    try {
      if (editingCard) {
        const res = await fetch(`${baseUrl}/cards/${editingCard.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ front, back }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setCardError(toUserMessage(data, "Failed to update card."));
          return;
        }
        setDeck((d) =>
          d
            ? {
                ...d,
                cards: d.cards.map((c) => (c.id === editingCard.id ? { ...c, front, back } : c)),
              }
            : null
        );
        setEditorOpen(false);
        setEditingCard(null);
      } else {
        const res = await fetch(`${baseUrl}/cards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ front, back }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setCardError(toUserMessage(data, "Failed to add card."));
          return;
        }
        setDeck((d) =>
          d
            ? {
                ...d,
                cards: [...d.cards, { id: data.id, front, back, order: d.cards.length }],
                cardCount: d.cardCount + 1,
              }
            : null
        );
        setCardFront("");
        setCardBack("");
      }
    } catch (err) {
      setCardError(toUserMessage(err, "Failed to save card."));
    } finally {
      setCardSaving(false);
    }
  };

  const deleteCard = async (card: Card) => {
    if (!confirm("Delete this card?")) return;
    try {
      const res = await fetch(`${baseUrl}/cards/${card.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(toUserMessage(data, "Failed to delete card."));
        return;
      }
      setDeck((d) =>
        d
          ? {
              ...d,
              cards: d.cards.filter((c) => c.id !== card.id),
              cardCount: d.cardCount - 1,
            }
          : null
      );
    } catch (e) {
      alert(toUserMessage(e, "Failed to delete card."));
    }
  };

  const runAction = async (action: "publish" | "archive" | "reactivate" | "delete") => {
    setActionLoading(action);
    try {
      let res: Response;
      if (action === "delete") {
        res = await fetch(baseUrl, { method: "DELETE" });
      } else {
        res = await fetch(`${baseUrl}/${action}`, { method: "POST" });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(toUserMessage(data, `Failed to ${action}.`));
        return;
      }
      setConfirmDialog(null);
      if (action === "delete") {
        router.push(`/${tenantSlug}/admin/flashcard-decks`);
        return;
      }
      setDeck((d) => (d && data ? { ...d, ...data, cards: d.cards } : d));
      loadDeck();
    } catch (e) {
      alert(toUserMessage(e, `Failed to ${action}.`));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted">
        <Spinner />
        Loading…
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="p-6">
        <p className="text-body">Deck not found.</p>
        <Link
          href={`/${tenantSlug}/admin/flashcard-decks`}
          className="text-brand-500 hover:underline mt-2 inline-block"
        >
          Back to Flashcard Decks
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <Link
          href={`/${tenantSlug}/admin/flashcard-decks`}
          className="text-sm text-muted hover:text-body"
        >
          ← Flashcard Decks
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-body">{deck.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={deck.status} />
            <span className="text-sm text-muted">
              {deck.cardCount} card{deck.cardCount !== 1 ? "s" : ""}
            </span>
          </div>
          {deck.description && (
            <p className="text-sm text-muted mt-2 max-w-2xl">{deck.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {deck.status === "DRAFT" && (
            <>
              <button
                type="button"
                onClick={() => setConfirmDialog("publish")}
                disabled={deck.cardCount === 0}
                className="h-9 px-4 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading === "publish" ? <Spinner /> : null}
                Publish deck
              </button>
              <button
                type="button"
                onClick={() => setConfirmDialog("delete")}
                className="h-9 px-4 rounded-lg border border-border text-error text-sm font-medium hover:bg-error-bg"
              >
                {actionLoading === "delete" ? <Spinner /> : null}
                Delete deck
              </button>
            </>
          )}
          {deck.status === "ACTIVE" && (
            <button
              type="button"
              onClick={() => setConfirmDialog("archive")}
              className="h-9 px-4 rounded-lg border border-border text-body text-sm font-medium hover:bg-warning-bg flex items-center gap-2"
            >
              {actionLoading === "archive" ? <Spinner /> : null}
              Archive deck
            </button>
          )}
          {deck.status === "ARCHIVED" && (
            <button
              type="button"
              onClick={() => setConfirmDialog("reactivate")}
              className="h-9 px-4 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 flex items-center gap-2"
            >
              {actionLoading === "reactivate" ? <Spinner /> : null}
              Reactivate deck
            </button>
          )}
        </div>
      </div>

      {deck.status === "ACTIVE" && (
        <div className="rounded-lg border border-border bg-surface-sidebar/30 p-4 mb-6 flex flex-wrap gap-6">
          <div>
            <span className="text-sm text-muted">Students reached</span>
            <p className="font-medium text-body">{deck.studentsReached}</p>
          </div>
          {deck.pendingUpdate > 0 && (
            <div>
              <span className="text-sm text-muted">Pending update</span>
              <p className="font-medium text-body">
                {deck.pendingUpdate} student{deck.pendingUpdate !== 1 ? "s" : ""} haven&apos;t applied
                the latest changes
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-body">Cards</h2>
        <button
          type="button"
          onClick={openAddCard}
          className="h-8 px-3 rounded-lg border border-border text-sm font-medium text-body hover:bg-surface-sidebar/30"
        >
          Add card
        </button>
      </div>

      {deck.cards.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card p-8 text-center text-muted">
          No cards yet. Add cards before publishing this deck to students.
        </div>
      ) : (
        <ul className="rounded-xl border border-border bg-surface-card divide-y divide-border">
          {deck.cards.map((card) => (
            <li key={card.id} className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium">{truncate(card.front)}</p>
                <p className="text-sm text-muted mt-1">{truncate(card.back)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditCard(card)}
                  className="text-sm text-brand-500 hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteCard(card)}
                  className="text-sm text-error hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Card editor modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface-card rounded-xl border border-border shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-body mb-4">
              {editingCard ? "Edit card" : "Add card"}
            </h3>
            <label className="block text-sm font-medium text-body mb-1">Front</label>
            <textarea
              value={cardFront}
              onChange={(e) => setCardFront(e.target.value)}
              placeholder="Question or term"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-base text-body placeholder:text-muted focus:outline-none focus:border-border-focus mb-4 resize-none"
              maxLength={1000}
            />
            <label className="block text-sm font-medium text-body mb-1">Back</label>
            <textarea
              value={cardBack}
              onChange={(e) => setCardBack(e.target.value)}
              placeholder="Answer or definition"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-base text-body placeholder:text-muted focus:outline-none focus:border-border-focus mb-4 resize-none"
              maxLength={2000}
            />
            {cardError && (
              <p className="text-sm text-error mb-4" role="alert">
                {cardError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!cardSaving) {
                    setEditorOpen(false);
                    setEditingCard(null);
                  }
                }}
                className="h-9 px-4 rounded-lg border border-border text-body text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCard}
                disabled={cardSaving}
                className="h-9 px-4 rounded-lg bg-brand-500 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {cardSaving ? <Spinner /> : null}
                {editingCard ? "Save" : "Add card"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialogs */}
      {confirmDialog === "publish" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface-card rounded-xl border border-border shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-body mb-2">Publish this deck?</h3>
            <p className="text-sm text-muted mb-6">
              This deck will be added to the review queue of all students in your organization.
              Students will receive a notification when you make future updates to this deck.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="h-9 px-4 rounded-lg border border-border text-body text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runAction("publish")}
                disabled={!!actionLoading}
                className="h-9 px-4 rounded-lg bg-brand-500 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading === "publish" ? <Spinner /> : null}
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog === "archive" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface-card rounded-xl border border-border shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-body mb-2">Archive this deck?</h3>
            <p className="text-sm text-muted mb-6">
              Students who already have this deck will keep their copy, but no new students will
              receive it. The deck becomes read-only after archiving.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="h-9 px-4 rounded-lg border border-border text-body text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runAction("archive")}
                disabled={!!actionLoading}
                className="h-9 px-4 rounded-lg border border-warning text-warning text-sm font-medium hover:bg-warning-bg flex items-center gap-2"
              >
                {actionLoading === "archive" ? <Spinner /> : null}
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog === "reactivate" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface-card rounded-xl border border-border shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-body mb-2">Reactivate this deck?</h3>
            <p className="text-sm text-muted mb-6">
              Students who don&apos;t yet have a copy will receive it. Existing holders are not
              affected.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="h-9 px-4 rounded-lg border border-border text-body text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runAction("reactivate")}
                disabled={!!actionLoading}
                className="h-9 px-4 rounded-lg bg-brand-500 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading === "reactivate" ? <Spinner /> : null}
                Reactivate
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface-card rounded-xl border border-border shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-body mb-2">Delete this deck?</h3>
            <p className="text-sm text-muted mb-6">
              This is a draft and has not been distributed to any students. It will be permanently
              deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="h-9 px-4 rounded-lg border border-border text-body text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runAction("delete")}
                disabled={!!actionLoading}
                className="h-9 px-4 rounded-lg bg-error text-white text-sm font-medium hover:bg-error/90 flex items-center gap-2"
              >
                {actionLoading === "delete" ? <Spinner /> : null}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

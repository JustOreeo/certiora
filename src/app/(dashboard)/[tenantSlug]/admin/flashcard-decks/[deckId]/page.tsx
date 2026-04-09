"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toUserMessage } from "@/lib/errors";

type Card = { id: string; front: string; back: string; order: number; status?: string };
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

const TRUNCATE_LEN = 120;
function truncate(s: string, len = TRUNCATE_LEN) {
  if (s.length <= len) return s;
  return s.slice(0, len) + "\u2026";
}

export default function AdminFlashcardDeckDetailPage() {
  const params = useParams<{ tenantSlug: string; deckId: string }>();
  const router = useRouter();
  const tenantSlug = params?.tenantSlug ?? "";
  const deckId = params?.deckId ?? "";

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
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
        Loading...
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

  // Filter out rejected cards for display
  const visibleCards = deck.cards.filter((c) => c.status !== "rejected");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <Link
          href={`/${tenantSlug}/admin/flashcard-decks`}
          className="text-sm text-muted hover:text-body"
        >
          &larr; Flashcard Decks
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-body">{deck.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={deck.status} />
            <span className="text-sm text-muted">
              {visibleCards.length} card{visibleCards.length !== 1 ? "s" : ""}
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
                disabled={visibleCards.length === 0}
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

      <h2 className="text-sm font-medium text-body mb-3">Cards</h2>

      {visibleCards.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card p-8 text-center text-muted">
          No cards in this deck.
        </div>
      ) : (
        <ul className="rounded-xl border border-border bg-surface-card divide-y divide-border">
          {visibleCards.map((card) => (
            <li key={card.id} className="p-4">
              <div className="min-w-0">
                <p className="text-body font-medium">{truncate(card.front)}</p>
                <p className="text-sm text-muted mt-1">{truncate(card.back)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Confirm dialogs */}
      {confirmDialog === "publish" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface-card rounded-xl border border-border shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-body mb-2">Publish this deck?</h3>
            <p className="text-sm text-muted mb-6">
              This deck will be added to the review queue of all students in your organization.
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
              receive it.
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
              Students who don&apos;t yet have a copy will receive it.
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
              This deck will be permanently deleted.
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

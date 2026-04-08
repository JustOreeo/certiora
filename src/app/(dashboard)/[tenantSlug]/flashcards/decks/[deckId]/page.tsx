"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toUserMessage } from "@/lib/errors";
import { Spinner } from "@/components/ui/Spinner";
import { SourceBadge } from "../../_components/SourceBadge";
import { CardEditorModal } from "../../_components/CardEditorModal";
import { DeckUpdateDiffModal } from "../../_components/DeckUpdateDiffModal";
import { BulkCardEditor } from "../../_components/BulkCardEditor";
import { CsvImportDialog } from "../../_components/CsvImportDialog";
import { MarkdownCardContent } from "@/components/MarkdownCardContent";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

type Card = { id: string; front: string; back: string; order: number; isOrphaned?: boolean };
type Deck = {
  id: string;
  name: string;
  description: string | null;
  source: "PERSONAL" | "SHARED" | "ADMIN_SEEDED" | "EXAM_GENERATED" | null;
  isPublic: boolean;
  shareCode: string | null;
  shareCodeCreatedAt: string | null;
  sourceDeckId: string | null;
  importedAtVersion: number | null;
  sourceDeck: { version: number } | null;
  retentionTarget: number | null;
  suggestedRetentionTarget: number | null;
  tags: { id: string; name: string }[];
  cardCount: number;
  dueToday: number;
};


/* eslint-disable @typescript-eslint/no-explicit-any */
function DragHandle({ listeners, attributes }: { listeners?: any; attributes?: any }) {
  return (
    <button
      type="button"
      className="cursor-grab active:cursor-grabbing p-1 text-muted hover:text-secondary touch-none"
      aria-label="Drag to reorder"
      {...listeners}
      {...attributes}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
        <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
        <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
      </svg>
    </button>
  );
}

function SortableCard({
  card,
  onEdit,
  onDelete,
  deleting,
}: {
  card: Card;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="bg-surface-card border border-border border-l-[3px] border-l-brand-200 rounded-xl p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-l-primary"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <DragHandle listeners={listeners} attributes={attributes} />
          <div className="min-w-0 flex-1">
            {card.isOrphaned && (
              <p className="text-xs text-secondary italic mb-1">No longer in source deck</p>
            )}
            <div className="font-medium text-body">
              <MarkdownCardContent
                content={card.front.length > 120 ? `${card.front.slice(0, 120)}…` : card.front}
                format="markdown"
              />
            </div>
            <details className="mt-2">
              <summary className="text-sm text-secondary cursor-pointer hover:text-body">
                Show back
              </summary>
              <div className="mt-2 text-sm text-body">
                <MarkdownCardContent content={card.back} format="markdown" />
              </div>
            </details>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="h-9 px-3 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card"
          >
            Edit
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onDelete}
            className="h-9 px-3 rounded-lg text-sm font-medium text-error border border-error/30 hover:bg-error/10 disabled:opacity-50"
          >
            {deleting ? "…" : "Delete"}
          </button>
        </div>
      </div>
    </li>
  );
}

export default function DeckDetailPage() {
  const params = useParams<{ tenantSlug: string; deckId: string }>();
  const router = useRouter();
  const tenantSlug = params?.tenantSlug ?? "";
  const deckId = params?.deckId ?? "";

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [cardTotal, setCardTotal] = useState(0);
  const [cardPage, setCardPage] = useState(1);
  const [cardSearch, setCardSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [updateDiffOpen, setUpdateDiffOpen] = useState(false);
  const [bulkEditorOpen, setBulkEditorOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [accountRetentionTarget, setAccountRetentionTarget] = useState<number>(0.9);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [deckToast, setDeckToast] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [cardPageSize, setCardPageSize] = useState(10);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const showDeckToast = (message: string) => {
    setDeckToast(message);
    setTimeout(() => setDeckToast(null), 3000);
  };

  const loadDeck = useCallback(async () => {
    if (!deckId) return;
    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}`);
      if (res.status === 404) {
        setDeck(null);
        setLoadError(null);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoadError(data.error || "Failed to load deck");
        setDeck(null);
        return;
      }
      const data = await res.json();
      setDeck(data);
      setLoadError(null);
    } catch (e) {
      console.error(e);
      setDeck(null);
      setLoadError("Failed to load deck");
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  const loadCards = useCallback(async (p = 1, search = "", pageSizeOverride?: number) => {
    if (!deckId) return;
    setCardsLoading(true);
    setCardsError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(pageSizeOverride ?? cardPageSize),
      });
      if (search) params.set("search", search);
      const res = await fetch(`/api/flashcards/decks/${deckId}/cards?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load cards");
      }
      const data = await res.json();
      setCards(data.items ?? []);
      setCardTotal(data.total ?? 0);
      setCardPage(data.page ?? 1);
    } catch (e) {
      console.error(e);
      setCards([]);
      setCardsError(e instanceof Error ? e.message : "Failed to load cards");
    } finally {
      setCardsLoading(false);
    }
  }, [deckId, cardPageSize]);

  // Debounce search
  const [debouncedCardSearch, setDebouncedCardSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCardSearch(cardSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [cardSearch]);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  useEffect(() => {
    loadCards(1, debouncedCardSearch);
  }, [loadCards, debouncedCardSearch]);

  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;
    fetch("/api/flashcards/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.retentionTarget != null)
          setAccountRetentionTarget(data.retentionTarget);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const handleAddCard = () => {
    setEditingCard(null);
    setEditorOpen(true);
  };

  const handleEditCard = (card: Card) => {
    setEditingCard(card);
    setEditorOpen(true);
  };

  const handleCardSaved = (saved: { id: string; front: string; back: string } | null) => {
    if (saved) {
      loadCards(cardPage, debouncedCardSearch);
      loadDeck(); // refresh cardCount
    }
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
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      setCardTotal((t) => t - 1);
      setDeck((d) => (d ? { ...d, cardCount: d.cardCount - 1 } : null));
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

  const handleRetentionChange = async (value: number | null) => {
    if (!deck) return;
    setRetentionSaving(true);
    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionTarget: value }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      setDeck((d) => (d ? { ...d, retentionTarget: data.retentionTarget } : null));
      showDeckToast("Deck intensity updated.");
    } catch (e) {
      showDeckToast(toUserMessage(e, "Update failed."));
    } finally {
      setRetentionSaving(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}/export`);
      if (!res.ok) {
        showDeckToast("Export failed");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+?)"/);
      const filename = match?.[1] ?? "deck-export.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showDeckToast("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cards.findIndex((c) => c.id === active.id);
    const newIndex = cards.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic reorder
    const reordered = [...cards];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    setCards(reordered);

    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}/cards/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardOrder: reordered.map((c, i) => ({ cardId: c.id, order: i })) }),
      });
      if (!res.ok) {
        showDeckToast("Reorder failed");
        loadCards(cardPage, debouncedCardSearch);
      }
    } catch {
      showDeckToast("Reorder failed");
      loadCards(cardPage, debouncedCardSearch);
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
      <div className="px-4 sm:px-6 md:px-8 py-6">
        <p className="text-secondary">{loadError ?? "Deck not found."}</p>
        <Link href={`/${tenantSlug}/flashcards`} className="text-primary hover:underline mt-2 inline-block">
          Back to Flashcards
        </Link>
      </div>
    );
  }

  const hasUpdate =
    deck.sourceDeckId &&
    deck.sourceDeck &&
    (deck.importedAtVersion ?? 0) < deck.sourceDeck.version;

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 relative">
      {deckToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-primary text-inverse text-sm font-medium shadow-lg"
          role="status"
        >
          {deckToast}
        </div>
      )}
      <div className="mb-6">
        <Link
          href={`/${tenantSlug}/flashcards`}
          className="text-sm text-secondary hover:text-body mb-2 inline-block"
        >
          ← Flashcards
        </Link>

        {hasUpdate && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 ${
              deck.source === "ADMIN_SEEDED"
                ? "bg-primary-subtle border-primary"
                : "bg-info-bg border-info-border"
            }`}
          >
            <p className="text-sm font-medium text-body">
              {deck.source === "ADMIN_SEEDED"
                ? "Your review center updated this deck."
                : "This deck has been updated by its author."}
            </p>
            <button
              type="button"
              onClick={() => setUpdateDiffOpen(true)}
              className="mt-1 text-sm font-medium text-primary hover:underline"
            >
              Review changes →
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="text-xl font-semibold text-body">{deck.name}</h1>
          <SourceBadge source={deck.source} />
        </div>
        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {deck.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-surface-base border border-border text-secondary"
            >
              {tag.name}
              <button
                type="button"
                onClick={async () => {
                  await fetch(`/api/flashcards/decks/${deckId}/tags/${tag.id}`, { method: "DELETE" });
                  setDeck((d) => d ? { ...d, tags: d.tags.filter((t) => t.id !== tag.id) } : null);
                }}
                className="text-secondary hover:text-error ml-0.5"
                aria-label={`Remove tag ${tag.name}`}
              >
                &times;
              </button>
            </span>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!tagInput.trim() || addingTag) return;
              setAddingTag(true);
              try {
                const res = await fetch(`/api/flashcards/decks/${deckId}/tags`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: tagInput.trim() }),
                });
                if (res.ok) {
                  const tag = await res.json();
                  setDeck((d) => d ? {
                    ...d,
                    tags: d.tags.some((t) => t.id === tag.id) ? d.tags : [...d.tags, tag],
                  } : null);
                  setTagInput("");
                }
              } finally {
                setAddingTag(false);
              }
            }}
            className="inline-flex"
          >
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="+ tag"
              maxLength={50}
              className="w-16 px-2 py-0.5 rounded-full text-xs border border-dashed border-border bg-transparent text-body placeholder:text-muted focus:w-24 focus:border-primary transition-all"
            />
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-secondary mb-3">
          <span>{deck.cardCount} cards</span>
          {deck.dueToday > 0 && (
            <span className="font-medium text-primary">{deck.dueToday} due today</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {deck.dueToday > 0 && (
            <Link
              href={`/${tenantSlug}/flashcards/study?deckId=${deck.id}`}
              className="inline-flex h-10 items-center gap-2 px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors anim-glow"
            >
              Study <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs">{deck.dueToday} due</span>
            </Link>
          )}
          {deck.cardCount > 0 && (
            <Link
              href={`/${tenantSlug}/flashcards/study?deckId=${deck.id}&mode=cram`}
              className="inline-flex h-10 items-center px-4 rounded-lg text-sm font-medium border border-border bg-surface-card hover:bg-surface-base transition-colors"
            >
              Cram all cards
            </Link>
          )}
        </div>
        {deck.description && (
          <p className="text-sm text-secondary mb-4">{deck.description}</p>
        )}

        {/* Review intensity (per-deck retention) §7.15 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-body mb-2">Review intensity</label>
          <select
            value={deck.retentionTarget != null ? String(deck.retentionTarget) : "default"}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "default") handleRetentionChange(null);
              else handleRetentionChange(Number(v));
            }}
            disabled={retentionSaving}
            className="rounded-lg border border-border bg-surface-base px-3 py-2 text-sm text-body disabled:opacity-50"
          >
            <option value="default">
              Use account default ({Math.round(accountRetentionTarget * 100)}%)
            </option>
            <option value="0.7">70% — Lightest</option>
            <option value="0.8">80% — Light</option>
            <option value="0.9">90% — Standard</option>
            <option value="0.95">95% — Thorough</option>
            <option value="0.97">97% — Maximum</option>
          </select>
          {deck.retentionTarget != null && (
            <p className="text-xs text-secondary mt-2">
              Cards in this deck will return more or less often than your other decks. Takes effect
              at your next review.
            </p>
          )}
          {deck.source === "ADMIN_SEEDED" && deck.suggestedRetentionTarget != null && (
            <p className="text-xs text-secondary mt-1">
              Your review center suggests {Math.round(deck.suggestedRetentionTarget * 100)}% for this
              deck.
            </p>
          )}
          {deck.retentionTarget != null && (
            <p className="text-xs text-secondary mt-1">
              At {Math.round(deck.retentionTarget * 100)}%, a card you know well will return in ~
              {Math.max(1, Math.round(21 * (Math.pow(deck.retentionTarget, -2) - 1) * (81 / 19)))}{" "}
              days.
            </p>
          )}
        </div>

        {deck.source !== "ADMIN_SEEDED" && !deck.sourceDeckId && (
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

        {!deck.sourceDeckId && (
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
        )}

        {/* Sticky cards toolbar */}
        <div className="sticky top-0 z-20 bg-surface-base/95 backdrop-blur-sm -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-3 border-b border-border mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-medium text-body">Cards</h2>
              {/* View toggle */}
              <div className="flex rounded-lg border border-border bg-surface-base p-0.5" role="group" aria-label="View mode">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`h-8 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    viewMode === "cards"
                      ? "bg-primary text-inverse"
                      : "text-secondary hover:text-body hover:bg-surface-card"
                  }`}
                  aria-pressed={viewMode === "cards"}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="inline mr-1" aria-hidden>
                    <rect x="1" y="1" width="14" height="6" rx="1.5" />
                    <rect x="1" y="9" width="14" height="6" rx="1.5" />
                  </svg>
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`h-8 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    viewMode === "table"
                      ? "bg-primary text-inverse"
                      : "text-secondary hover:text-body hover:bg-surface-card"
                  }`}
                  aria-pressed={viewMode === "table"}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="inline mr-1" aria-hidden>
                    <rect x="1" y="1" width="14" height="3" rx="1" />
                    <rect x="1" y="5.5" width="14" height="3" rx="1" />
                    <rect x="1" y="10" width="14" height="3" rx="1" />
                  </svg>
                  Table
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={cardSearch}
                onChange={(e) => setCardSearch(e.target.value)}
                placeholder="Search cards…"
                className="px-3 py-2 rounded-lg border border-border bg-surface-base text-body text-sm w-48"
                aria-label="Search cards"
              />
              {deck.cardCount > 0 && (
                <button
                  type="button"
                  disabled={exporting}
                  onClick={handleExportCsv}
                  className="h-10 px-3 rounded-lg text-sm font-medium border border-border bg-surface-card hover:bg-surface-base whitespace-nowrap disabled:opacity-50 cursor-pointer"
                >
                  {exporting ? "Exporting…" : "Export CSV"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setCsvImportOpen(true)}
                className="h-10 px-3 rounded-lg text-sm font-medium border border-border bg-surface-card hover:bg-surface-base whitespace-nowrap cursor-pointer"
              >
                Import CSV
              </button>
              <button
                type="button"
                onClick={() => setBulkEditorOpen(true)}
                className="h-10 px-3 rounded-lg text-sm font-medium border border-border bg-surface-card hover:bg-surface-base whitespace-nowrap cursor-pointer"
              >
                Bulk Add
              </button>
              <button
                type="button"
                onClick={handleAddCard}
                className="h-10 px-4 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover whitespace-nowrap cursor-pointer"
              >
                Add Card
              </button>
            </div>
          </div>
        </div>
      </div>

      {cardsLoading && (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      )}

      {!cardsLoading && cardsError ? (
        <div className="bg-surface-card border border-border rounded-xl px-6 py-8 text-center shadow-sm">
          <p className="text-sm text-error">{cardsError}</p>
          <button
            type="button"
            onClick={() => loadCards(cardPage, debouncedCardSearch)}
            className="inline-flex mt-3 h-9 items-center px-4 rounded-lg text-sm font-medium border border-border bg-surface-base hover:bg-surface-card cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : !cardsLoading && cards.length === 0 && !debouncedCardSearch ? (
        <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-secondary">No cards yet. Add your first card to start building this deck.</p>
          <button
            type="button"
            onClick={handleAddCard}
            className="inline-flex mt-4 h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover cursor-pointer"
          >
            Add card
          </button>
        </div>
      ) : !cardsLoading && cards.length === 0 && debouncedCardSearch ? (
        <div className="bg-surface-card border border-border rounded-xl px-6 py-8 text-center shadow-sm">
          <p className="text-sm text-secondary">No cards match &ldquo;{debouncedCardSearch}&rdquo;</p>
        </div>
      ) : !cardsLoading && cards.length > 0 ? (
        <>
          {/* Card view — drag-and-drop sortable list */}
          {viewMode === "cards" && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-3">
                  {cards.map((card) => (
                    <SortableCard
                      key={card.id}
                      card={card}
                      onEdit={() => handleEditCard(card)}
                      onDelete={() => handleDeleteCard(card)}
                      deleting={deletingCardId === card.id}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          {/* Table view — compact rows */}
          {viewMode === "table" && (
            <div className="bg-surface-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-base/50">
                      <th scope="col" className="text-left py-3 px-4 font-medium text-body w-[4%]">#</th>
                      <th scope="col" className="text-left py-3 px-4 font-medium text-body w-[40%]">Front</th>
                      <th scope="col" className="text-left py-3 px-4 font-medium text-body w-[40%]">Back</th>
                      <th scope="col" className="text-right py-3 px-4 font-medium text-body w-[16%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((card, i) => (
                      <tr key={card.id} className="border-b border-border last:border-0 hover:bg-surface-base/50 transition-colors">
                        <td className="py-3 px-4 text-secondary tabular-nums">
                          {(cardPage - 1) * cardPageSize + i + 1}
                        </td>
                        <td className="py-3 px-4 text-body">
                          <span className="line-clamp-2">{card.front.length > 100 ? `${card.front.slice(0, 100)}…` : card.front}</span>
                          {card.isOrphaned && (
                            <span className="text-xs text-secondary italic ml-1">orphaned</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-secondary">
                          <span className="line-clamp-2">{card.back.length > 100 ? `${card.back.slice(0, 100)}…` : card.back}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditCard(card)}
                              className="h-8 px-2.5 rounded-md text-xs font-medium border border-border bg-surface-base hover:bg-surface-card cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={deletingCardId === card.id}
                              onClick={() => handleDeleteCard(card)}
                              className="h-8 px-2.5 rounded-md text-xs font-medium text-error border border-error/30 hover:bg-error/10 disabled:opacity-50 cursor-pointer"
                            >
                              {deletingCardId === card.id ? "…" : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {cardTotal > 10 && (() => {
            const totalPages = Math.ceil(cardTotal / cardPageSize);
            // Build page numbers: show up to 5 pages centered around current
            const pages: (number | "…")[] = [];
            if (totalPages <= 7) {
              for (let i = 1; i <= totalPages; i++) pages.push(i);
            } else {
              pages.push(1);
              if (cardPage > 3) pages.push("…");
              const start = Math.max(2, cardPage - 1);
              const end = Math.min(totalPages - 1, cardPage + 1);
              for (let i = start; i <= end; i++) pages.push(i);
              if (cardPage < totalPages - 2) pages.push("…");
              pages.push(totalPages);
            }
            return (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-secondary">
                    Showing {(cardPage - 1) * cardPageSize + 1}–{Math.min(cardPage * cardPageSize, cardTotal)} of {cardTotal}
                  </span>
                  <select
                    value={cardPageSize}
                    onChange={(e) => {
                      const newSize = Number(e.target.value);
                      setCardPageSize(newSize);
                      loadCards(1, debouncedCardSearch, newSize);
                    }}
                    className="h-8 pl-2 pr-6 rounded-md border border-border bg-surface-base text-xs text-body cursor-pointer"
                    aria-label="Cards per page"
                  >
                    <option value={10}>10 / page</option>
                    <option value={20}>20 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={cardPage <= 1}
                    onClick={() => loadCards(cardPage - 1, debouncedCardSearch)}
                    className="inline-flex h-9 items-center px-3 rounded-lg text-xs font-medium border border-border bg-surface-card hover:bg-surface-base disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  {pages.map((p, idx) =>
                    p === "…" ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-secondary">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => loadCards(p, debouncedCardSearch)}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          p === cardPage
                            ? "bg-primary text-inverse"
                            : "border border-border bg-surface-card hover:bg-surface-base text-body"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    disabled={cardPage * cardPageSize >= cardTotal}
                    onClick={() => loadCards(cardPage + 1, debouncedCardSearch)}
                    className="inline-flex h-9 items-center px-3 rounded-lg text-xs font-medium border border-border bg-surface-card hover:bg-surface-base disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            );
          })()}
        </>
      ) : null}

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

      <DeckUpdateDiffModal
        open={updateDiffOpen}
        deckId={deckId}
        onClose={() => setUpdateDiffOpen(false)}
        onApplied={loadDeck}
      />

      <BulkCardEditor
        open={bulkEditorOpen}
        deckId={deckId}
        onClose={() => setBulkEditorOpen(false)}
        onDone={() => {
          setBulkEditorOpen(false);
          loadCards(1, debouncedCardSearch);
          loadDeck();
        }}
      />

      <CsvImportDialog
        open={csvImportOpen}
        deckId={deckId}
        onClose={() => setCsvImportOpen(false)}
        onDone={(created) => {
          setCsvImportOpen(false);
          showDeckToast(`Imported ${created} card${created === 1 ? "" : "s"}`);
          loadCards(1, debouncedCardSearch);
          loadDeck();
        }}
      />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toUserMessage } from "@/lib/errors";

type AdminDeck = {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  version: number;
  suggestedRetentionTarget: number | null;
  cardCount: number;
  studentCount: number;
  updatedAt: string;
};

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function StatusBadge({ status }: { status: AdminDeck["status"] }) {
  const map: Record<AdminDeck["status"], { label: string; className: string }> = {
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

export default function AdminFlashcardDecksPage() {
  const { status } = useSession();
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const tenantSlug = params?.tenantSlug ?? "";

  const [decks, setDecks] = useState<AdminDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const loadDecks = async () => {
    if (!tenantSlug) return;
    try {
      const res = await fetch(`/api/${tenantSlug}/admin/flashcard-decks`);
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
    if (tenantSlug) loadDecks();
  }, [tenantSlug]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) {
      alert("Enter a deck name.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/${tenantSlug}/admin/flashcard-decks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: createDescription.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(toUserMessage(data, "Failed to create deck."));
        return;
      }
      setCreateModalOpen(false);
      setCreateName("");
      setCreateDescription("");
      router.push(`/${tenantSlug}/admin/flashcard-decks/${data.id}`);
    } catch (e) {
      alert(toUserMessage(e, "Failed to create deck."));
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return s;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-body">Flashcard Decks</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/${tenantSlug}/admin/flashcard-decks/analytics`}
            className="h-9 px-4 rounded-lg border border-border bg-surface-card text-sm font-medium text-body hover:bg-surface-base inline-flex items-center transition-colors"
          >
            Analytics
          </Link>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="h-9 px-4 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            New deck
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted">
          <Spinner />
          Loading…
        </div>
      ) : decks.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card p-8 text-center">
          <p className="text-body mb-2">No flashcard decks yet.</p>
          <p className="text-sm text-muted mb-4">
            Create a deck, add cards, then publish it to your students.
          </p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="h-9 px-4 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            Create deck
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface-sidebar/30">
                <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                  Cards
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                  Students reached
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                  Last updated
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {decks.map((deck) => (
                <tr key={deck.id} className="border-b border-border last:border-0 hover:bg-surface-sidebar/20">
                  <td className="px-4 py-3">
                    <Link
                      href={`/${tenantSlug}/admin/flashcard-decks/${deck.id}`}
                      className="font-medium text-body hover:text-brand-500"
                    >
                      {deck.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={deck.status} />
                  </td>
                  <td className="px-4 py-3 text-body">{deck.cardCount}</td>
                  <td className="px-4 py-3 text-body">{deck.studentCount}</td>
                  <td className="px-4 py-3 text-muted text-sm">{formatDate(deck.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${tenantSlug}/admin/flashcard-decks/${deck.id}`}
                      className="text-sm font-medium text-brand-500 hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface-card rounded-xl border border-border shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-body mb-4">Create deck</h2>
            <label className="block text-sm font-medium text-body mb-1">Name</label>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Deck name"
              className="w-full h-10 px-3 text-sm border border-border rounded-lg bg-surface-base text-body placeholder:text-muted focus:outline-none focus:border-border-focus mb-4"
              maxLength={100}
            />
            <label className="block text-sm font-medium text-body mb-1">Description (optional)</label>
            <textarea
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Short description"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface-base text-body placeholder:text-muted focus:outline-none focus:border-border-focus mb-6 resize-none"
              maxLength={300}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!creating) setCreateModalOpen(false);
                }}
                className="h-9 px-4 rounded-lg border border-border text-body text-sm font-medium hover:bg-surface-sidebar/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !createName.trim()}
                className="h-9 px-4 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
              >
                {creating ? <Spinner /> : null}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

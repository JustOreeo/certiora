"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

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
        <div>
          <h1 className="text-xl font-semibold text-body">Flashcard Decks</h1>
          <p className="text-sm text-muted mt-0.5">
            Decks are generated from PDF uploads via the Content Pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${tenantSlug}/admin/flashcard-decks/analytics`}
            className="h-9 px-4 rounded-lg border border-border bg-surface-card text-sm font-medium text-body hover:bg-surface-base inline-flex items-center transition-colors"
          >
            Analytics
          </Link>
          <Link
            href={`/${tenantSlug}/admin/source-materials`}
            className="h-9 px-4 rounded-lg bg-primary text-inverse text-sm font-medium hover:bg-primary-hover transition-colors inline-flex items-center gap-2"
          >
            Upload PDF
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted">
          <Spinner />
          Loading...
        </div>
      ) : decks.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card p-8 text-center">
          <p className="text-body mb-2">No flashcard decks yet.</p>
          <p className="text-sm text-muted mb-4">
            Upload a PDF through the Content Pipeline to generate flashcard decks automatically.
          </p>
          <Link
            href={`/${tenantSlug}/admin/source-materials`}
            className="h-9 px-4 rounded-lg bg-primary text-inverse text-sm font-medium hover:bg-primary-hover transition-colors inline-flex items-center"
          >
            Go to Content Pipeline
          </Link>
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
    </div>
  );
}

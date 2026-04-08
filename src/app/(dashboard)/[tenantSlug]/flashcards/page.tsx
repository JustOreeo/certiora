"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";
import { CelebrationIcon } from "@/components/ui/Icons";
import { FlashcardsMyDecksTab } from "./_components/FlashcardsMyDecksTab";
import { FlashcardsLibraryTab } from "./_components/FlashcardsLibraryTab";
import { FlashcardsAnalyticsTab } from "./_components/FlashcardsAnalyticsTab";
import { FlashcardsSettingsTab } from "./_components/FlashcardsSettingsTab";

type TabId = "decks" | "library" | "analytics" | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "decks", label: "My Decks" },
  { id: "library", label: "Library" },
  { id: "analytics", label: "Analytics" },
  { id: "settings", label: "Settings" },
];

type DueSummary = {
  dueToday: number;
  dueTomorrow: number;
  total: number;
};

/* ── Hero: due-cards summary above tabs ─────────────────────────────── */

function DueSummaryHero({
  tenantSlug,
  onNavigateToDecks,
}: {
  tenantSlug: string;
  onNavigateToDecks: () => void;
}) {
  const [summary, setSummary] = useState<DueSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/srs/summary");
      if (!res.ok) return;
      const data = await res.json();
      setSummary({
        dueToday: data.dueToday ?? 0,
        dueTomorrow: data.dueTomorrow ?? 0,
        total: data.total ?? 0,
      });
    } catch {
      // Non-critical — hero just won't show counts
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (loading) {
    return (
      <div className="bg-surface-card border border-border rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-surface-base animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 bg-surface-base rounded animate-pulse" />
            <div className="h-4 w-56 bg-surface-base rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const hasDue = summary && summary.dueToday > 0;
  const hasCards = summary && summary.total > 0;

  // No cards at all — prompt to create/discover
  if (!hasCards) {
    return (
      <div className="bg-surface-card border border-border rounded-2xl p-6 mb-6 shadow-sm text-center">
        <p className="text-body font-medium mb-1">Welcome to Flashcards</p>
        <p className="text-sm text-secondary mb-4">
          Create a deck or explore the library to start studying.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            type="button"
            onClick={onNavigateToDecks}
            className="inline-flex h-10 items-center px-5 rounded-xl text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors cursor-pointer"
          >
            Create a Deck
          </button>
        </div>
      </div>
    );
  }

  // All caught up
  if (!hasDue) {
    return (
      <div className="bg-surface-card border border-border rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <CelebrationIcon className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body font-semibold">You're all caught up!</p>
            <p className="text-sm text-secondary">
              No cards due right now.
              {summary.dueTomorrow > 0 && ` ${summary.dueTomorrow} due tomorrow.`}
              {" "}Come back later or add more cards.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Cards are due — main hero
  return (
    <div className="bg-gradient-to-br from-primary/5 to-[#7C3AED]/5 border border-primary/20 rounded-2xl p-6 mb-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-body font-semibold text-lg">
              {summary.dueToday} card{summary.dueToday !== 1 ? "s" : ""} due today
            </p>
            <p className="text-sm text-secondary">
              {summary.dueTomorrow > 0 && `${summary.dueTomorrow} due tomorrow · `}
              {summary.total} total cards
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/${tenantSlug}/flashcards/study`}
            className="inline-flex h-11 items-center gap-2 px-6 rounded-xl text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
            Start Review
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function FlashcardsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params?.tenantSlug ?? "";

  const [activeTab, setActiveTab] = useState<TabId>("decks");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      setLoading(false);
    }
  }, [status, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8">
      {/* Hero: due-cards summary */}
      <DueSummaryHero
        tenantSlug={tenantSlug}
        onNavigateToDecks={() => setActiveTab("decks")}
      />

      {/* Tabs */}
      <div
        className="flex flex-wrap gap-1 border-b border-border mb-6"
        role="tablist"
        aria-label="Flashcard sections"
      >
        {TABS.map((tab, idx) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            tabIndex={activeTab === tab.id ? 0 : -1}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                const next = TABS[(idx + 1) % TABS.length];
                setActiveTab(next.id);
                document.getElementById(`tab-${next.id}`)?.focus();
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                const prev = TABS[(idx - 1 + TABS.length) % TABS.length];
                setActiveTab(prev.id);
                document.getElementById(`tab-${prev.id}`)?.focus();
              } else if (e.key === "Home") {
                e.preventDefault();
                setActiveTab(TABS[0].id);
                document.getElementById(`tab-${TABS[0].id}`)?.focus();
              } else if (e.key === "End") {
                e.preventDefault();
                setActiveTab(TABS[TABS.length - 1].id);
                document.getElementById(`tab-${TABS[TABS.length - 1].id}`)?.focus();
              }
            }}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "bg-surface-card border border-border border-b-0 -mb-px text-body"
                : "text-secondary hover:text-body hover:bg-surface-base"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === "decks" && (
        <div id="panel-decks" role="tabpanel" aria-labelledby="tab-decks">
          <FlashcardsMyDecksTab tenantSlug={tenantSlug} />
        </div>
      )}
      {activeTab === "library" && (
        <div id="panel-library" role="tabpanel" aria-labelledby="tab-library">
          <FlashcardsLibraryTab
            tenantSlug={tenantSlug}
            onNavigateToDecks={() => setActiveTab("decks")}
          />
        </div>
      )}
      {activeTab === "analytics" && (
        <div id="panel-analytics" role="tabpanel" aria-labelledby="tab-analytics">
          <FlashcardsAnalyticsTab tenantSlug={tenantSlug} />
        </div>
      )}
      {activeTab === "settings" && (
        <div id="panel-settings" role="tabpanel" aria-labelledby="tab-settings">
          <FlashcardsSettingsTab tenantSlug={tenantSlug} />
        </div>
      )}
    </div>
  );
}

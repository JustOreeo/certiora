"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toUserMessage } from "@/lib/errors";
import { FlashcardsReviewTab } from "./_components/FlashcardsReviewTab";
import { FlashcardsMyDecksTab } from "./_components/FlashcardsMyDecksTab";
import { FlashcardsLibraryTab } from "./_components/FlashcardsLibraryTab";
import { FlashcardsAnalyticsTab } from "./_components/FlashcardsAnalyticsTab";
import { FlashcardsSettingsTab } from "./_components/FlashcardsSettingsTab";

type TabId = "review" | "decks" | "library" | "analytics" | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "decks", label: "My Decks" },
  { id: "library", label: "Library" },
  { id: "analytics", label: "Analytics" },
  { id: "settings", label: "Settings" },
];

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center shadow-sm">
      <p className="text-sm text-secondary">{title} — coming soon.</p>
    </div>
  );
}

export default function FlashcardsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params?.tenantSlug ?? "";

  const [activeTab, setActiveTab] = useState<TabId>("review");
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
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? "bg-surface-card border border-border border-b-0 -mb-px text-body"
                : "text-secondary hover:text-body hover:bg-surface-base"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "review" && (
        <div id="panel-review" role="tabpanel" aria-labelledby="tab-review">
          <FlashcardsReviewTab
            tenantSlug={tenantSlug}
            onNavigateToDecks={() => setActiveTab("decks")}
            onNavigateToLibrary={() => setActiveTab("library")}
          />
        </div>
      )}
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
          <FlashcardsAnalyticsTab
            tenantSlug={tenantSlug}
            onNavigateToReview={() => setActiveTab("review")}
          />
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

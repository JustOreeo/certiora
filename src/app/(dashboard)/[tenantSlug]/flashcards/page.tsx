"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toUserMessage } from "@/lib/errors";
import { FlashcardsReviewTab } from "./_components/FlashcardsReviewTab";
import { FlashcardsMyDecksTab } from "./_components/FlashcardsMyDecksTab";
import { FlashcardsLibraryTab } from "./_components/FlashcardsLibraryTab";

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
    <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 max-w-4xl mx-auto">
      <div className="flex flex-wrap gap-1 border-b border-border mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? "bg-surface-card border border-border border-b-0 -mb-px text-body"
                : "text-secondary hover:text-body hover:bg-surface-base"
            }`}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "review" && (
        <div role="tabpanel" aria-labelledby="tab-review">
          <FlashcardsReviewTab tenantSlug={tenantSlug} />
        </div>
      )}
      {activeTab === "decks" && (
        <div role="tabpanel" aria-labelledby="tab-decks">
          <FlashcardsMyDecksTab tenantSlug={tenantSlug} />
        </div>
      )}
      {activeTab === "library" && (
        <div role="tabpanel" aria-labelledby="tab-library">
          <FlashcardsLibraryTab tenantSlug={tenantSlug} />
        </div>
      )}
      {activeTab === "analytics" && (
        <div role="tabpanel" aria-labelledby="tab-analytics">
          <PlaceholderTab title="Flashcard analytics" />
        </div>
      )}
      {activeTab === "settings" && (
        <div role="tabpanel" aria-labelledby="tab-settings">
          <PlaceholderTab title="FSRS settings" />
        </div>
      )}
    </div>
  );
}

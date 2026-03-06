"use client";

type DeckSource = "PERSONAL" | "SHARED" | "ADMIN_SEEDED" | "EXAM_GENERATED" | null;

const LABELS: Record<NonNullable<DeckSource>, string> = {
  PERSONAL: "Personal",
  SHARED: "Shared",
  ADMIN_SEEDED: "From review center",
  EXAM_GENERATED: "From exam mistakes",
};

const STYLES: Record<NonNullable<DeckSource>, string> = {
  PERSONAL: "bg-surface-base border border-border text-secondary",
  SHARED: "bg-info-bg border border-info-border text-info",
  ADMIN_SEEDED: "bg-primary-subtle border border-primary text-primary",
  EXAM_GENERATED: "bg-warning-bg border border-warning-border text-warning",
};

export function SourceBadge({ source }: { source: DeckSource }) {
  if (source == null) return null;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STYLES[source]}`}
    >
      {LABELS[source]}
    </span>
  );
}

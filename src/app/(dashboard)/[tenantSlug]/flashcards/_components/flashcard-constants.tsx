import {
  XCircleIcon,
  QuestionCircleIcon,
  ThumbsUpIcon,
  LightningIcon,
} from "@/components/ui/Icons";

/* ── Grade icon by grade number ─────────────────────────────────────── */

export function GradeIcon({ grade, className }: { grade: 1 | 2 | 3 | 4; className?: string }) {
  switch (grade) {
    case 1:
      return <XCircleIcon className={className ?? "w-5 h-5 text-red-500"} />;
    case 2:
      return <QuestionCircleIcon className={className ?? "w-5 h-5 text-orange-500"} />;
    case 3:
      return <ThumbsUpIcon className={className ?? "w-5 h-5 text-green-600"} />;
    case 4:
      return <LightningIcon className={className ?? "w-5 h-5 text-blue-500"} />;
  }
}

/* ── Shared grade button config ─────────────────────────────────────── */

export type GradeButtonConfig = {
  label: string;
  grade: 1 | 2 | 3 | 4;
  key: string;
  border: string;
  hover: string;
};

export const GRADE_BUTTONS: GradeButtonConfig[] = [
  { label: "Not yet", grade: 1, key: "1", border: "border-red-300", hover: "hover:bg-red-50" },
  { label: "Almost had it", grade: 2, key: "2", border: "border-orange-300", hover: "hover:bg-orange-50" },
  { label: "I remember this", grade: 3, key: "3", border: "border-green-300", hover: "hover:bg-green-50" },
  { label: "Too easy for me", grade: 4, key: "4", border: "border-blue-300", hover: "hover:bg-blue-50" },
];

/* ── Interval formatting (deduplicated) ─────────────────────────────── */

export function formatIntervalShort(days: number): string {
  if (days < 1) return "< 1d";
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export function formatIntervalLong(days: number): string {
  if (days < 1) return "< 1 day";
  if (days === 1) return "1 day";
  return `${days} days`;
}

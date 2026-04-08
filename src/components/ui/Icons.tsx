type IconProps = { className?: string };

/* ── General-purpose icons ──────────────────────────────────────────── */

export function CheckCircleIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function XCircleIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  );
}

export function QuestionCircleIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function LightbulbIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18h6M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A7 7 0 1 0 7.5 11.5c.76.76 1.23 1.52 1.41 2.5" />
    </svg>
  );
}

export function LightningIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function ThumbsUpIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
      <path d="M7 11V4a2 2 0 012-2h0a2 2 0 012 2v3h4.5a2.5 2.5 0 012.46 2.95l-1.14 6A2.5 2.5 0 0114.36 16H7" />
    </svg>
  );
}

export function DownloadIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function HintIcon({ className = "w-3.5 h-3.5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18h6M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A7 7 0 1 0 7.5 11.5c.76.76 1.23 1.52 1.41 2.5" />
    </svg>
  );
}

export function ArrowRightIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/* ── Empty state illustrations (larger, geometric) ──────────────────── */

export function CelebrationIcon({ className = "w-12 h-12" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      {/* Central star */}
      <path d="M24 8l3.09 9.51H37l-7.91 5.75 3.02 9.3L24 26.82l-8.11 5.74 3.02-9.3L11 17.51h9.91L24 8z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Sparkles */}
      <circle cx="10" cy="10" r="1.5" fill="currentColor" opacity="0.4" />
      <circle cx="38" cy="12" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="8" cy="32" r="1" fill="currentColor" opacity="0.35" />
      <circle cx="40" cy="34" r="1.5" fill="currentColor" opacity="0.25" />
      <path d="M14 6l1 3-1 3-1-3 1-3z" fill="currentColor" opacity="0.4" />
      <path d="M36 6l1 3-1 3-1-3 1-3z" fill="currentColor" opacity="0.3" />
      <path d="M6 22l2 1-2 1-2-1 2-1z" fill="currentColor" opacity="0.3" />
      <path d="M42 22l2 1-2 1-2-1 2-1z" fill="currentColor" opacity="0.25" />
    </svg>
  );
}

export function EmptyBoxIcon({ className = "w-12 h-12" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      {/* Box body */}
      <path d="M8 18l16-8 16 8v16l-16 8-16-8V18z" fill="currentColor" opacity="0.08" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Box center line */}
      <path d="M24 26v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Box top flaps */}
      <path d="M8 18l16 8 16-8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Open flap hints */}
      <path d="M16 12l-4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M32 12l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

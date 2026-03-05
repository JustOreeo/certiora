"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTenantBranding, darkenHex } from "@/contexts/TenantBrandingContext";

const DEFAULT_PRIMARY = "#4B4EFC";

function CertioraLogoMark({ primaryColor }: { primaryColor: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="9" fill={primaryColor} />
      <path d="M20 8L11 12V19C11 23.4 15 27.5 20 29C25 27.5 29 23.4 29 19V12L20 8Z" fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 19.5L18.5 22L24 17" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function StudentNav({
  tenantSlug,
  children,
}: {
  tenantSlug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const branding = useTenantBranding();
  const slugSegment = tenantSlug ? `/${tenantSlug}` : "";
  const isStudentRoute =
    pathname === `${slugSegment}/exams` ||
    pathname.startsWith(`${slugSegment}/exams/`) ||
    pathname === `${slugSegment}/flashcards` ||
    pathname === `${slugSegment}/analytics`;

  // Distraction-free: no header/nav when taking an active exam (exams/:id, not review)
  const isActiveExam =
    pathname.startsWith(`${slugSegment}/exams/`) &&
    !pathname.includes("/review");

  const primary = branding.primaryColor ?? DEFAULT_PRIMARY;
  const cssVars = branding.primaryColor
    ? {
        ["--color-primary" as string]: primary,
        ["--color-brand-500" as string]: primary,
        ["--color-brand-600" as string]: darkenHex(primary, 0.08),
        ["--color-brand-700" as string]: darkenHex(primary, 0.16),
        ["--color-text-link" as string]: primary,
        ["--color-text-link-hover" as string]: darkenHex(primary, 0.16),
        ["--color-border-focus" as string]: primary,
      }
    : undefined;

  if (!isStudentRoute) {
    return <>{children}</>;
  }

  // During active exam attempt, render only content (minimal header is inside the exam page)
  if (isActiveExam) {
    return (
      <div className="min-h-screen bg-surface-base" style={cssVars}>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base" style={cssVars}>
      <header className="min-h-[60px] bg-surface-card border-b border-border flex items-center px-4 sm:px-6 justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href={`/${tenantSlug}/exams`} className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            {branding.logoUrl ? (
              <span className="relative w-7 h-7 flex-shrink-0 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={branding.logoUrl} alt="" className="max-w-full max-h-full object-contain" />
              </span>
            ) : (
              <CertioraLogoMark primaryColor={primary} />
            )}
            <span className="font-semibold text-[15px] text-heading">{branding.name}</span>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6 ml-2 sm:ml-6 shrink-0">
            <Link
              href={`/${tenantSlug}/exams`}
              className={`text-sm font-medium transition-colors ${
                pathname === `${slugSegment}/exams` || pathname.startsWith(`${slugSegment}/exams/`)
                  ? "text-heading font-semibold"
                  : "text-link hover:text-link"
              }`}
            >
              Exams
            </Link>
            <Link
              href={`/${tenantSlug}/flashcards`}
              className={`text-sm font-medium transition-colors ${
                pathname === `${slugSegment}/flashcards`
                  ? "text-heading font-semibold"
                  : "text-link hover:text-link"
              }`}
            >
              Flashcards
            </Link>
            <Link
              href={`/${tenantSlug}/analytics`}
              className={`text-sm font-medium transition-colors ${
                pathname === `${slugSegment}/analytics`
                  ? "text-heading font-semibold"
                  : "text-link hover:text-link"
              }`}
            >
              Analytics
            </Link>
          </nav>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center py-2 px-2 -my-1 -mr-1 text-sm text-secondary hover:text-body transition-colors rounded-lg hover:bg-surface-hover"
          aria-label="Sign out"
        >
          Sign out
        </button>
      </header>
      {children}
    </div>
  );
}

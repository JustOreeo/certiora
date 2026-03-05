"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ReactNode } from "react";
import { useTenantBranding, darkenHex } from "@/contexts/TenantBrandingContext";

const DEFAULT_PRIMARY = "#4B4EFC";

// ── Icons (match admin style) ─────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconFileText() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconCards() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="14" height="10" rx="2" />
      <rect x="8" y="9" width="14" height="10" rx="2" />
    </svg>
  );
}

function IconBarChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

function IconLogOut() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function CertioraLogoMark({ primaryColor }: { primaryColor: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="9" fill={primaryColor} />
      <path d="M20 8L11 12V19C11 23.4 15 27.5 20 29C25 27.5 29 23.4 29 19V12L20 8Z" fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 19.5L18.5 22L24 17" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
};

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
    pathname === slugSegment ||
    pathname === `${slugSegment}/exams` ||
    pathname.startsWith(`${slugSegment}/exams/`) ||
    pathname === `${slugSegment}/flashcards` ||
    pathname === `${slugSegment}/analytics`;

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

  if (isActiveExam) {
    return (
      <div className="min-h-screen bg-surface-base" style={cssVars}>
        {children}
      </div>
    );
  }

  const navItems: NavItem[] = [
    { href: slugSegment, label: "Home", icon: <IconGrid />, exact: true },
    { href: `${slugSegment}/exams`, label: "Exams", icon: <IconFileText /> },
    { href: `${slugSegment}/flashcards`, label: "Flashcards", icon: <IconCards /> },
    { href: `${slugSegment}/analytics`, label: "Analytics", icon: <IconBarChart /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={cssVars}>
      <aside className="w-[240px] flex-shrink-0 flex flex-col bg-surface-sidebar">
        <div className="h-[60px] flex items-center px-5 gap-3 shrink-0">
          <Link href={slugSegment} className="flex items-center gap-3 min-w-0">
            {branding.logoUrl ? (
              <span className="relative w-7 h-7 flex-shrink-0 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={branding.logoUrl} alt="" className="max-w-full max-h-full object-contain" />
              </span>
            ) : (
              <CertioraLogoMark primaryColor={primary} />
            )}
            <span className="font-semibold text-[15px] leading-none text-sidebar-active truncate">
              {branding.name}
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors ${
                  active
                    ? "bg-white/[0.12] text-white"
                    : "text-sidebar hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4 pt-3 shrink-0 border-t border-white/[0.08]">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13.5px] font-medium text-sidebar hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <IconLogOut />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto bg-surface-base">
        {children}
      </main>
    </div>
  );
}

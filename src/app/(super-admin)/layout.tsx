"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, SessionProvider } from "next-auth/react";
import { ReactNode, useEffect, useState } from "react";

function CertioraLogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="9" fill="#4B4EFC" />
      <path
        d="M20 8L11 12V19C11 23.4 15 27.5 20 29C25 27.5 29 23.4 29 19V12L20 8Z"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M16 19.5L18.5 22L24 17"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconOverview() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconOrganization() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path
        d="M9 9h.01M9 12h.01M9 15h.01M15 9h.01M15 12h.01M15 15h.01"
        strokeWidth="2"
      />
    </svg>
  );
}

function IconMail() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function IconLogOut() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function CountBadge({ count }: { count: number | undefined }) {
  if (count === undefined) return null;
  return (
    <span className="ml-auto text-[11px] font-medium text-[#6B7280] bg-[#F3F4F6] rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums">
      {count}
    </span>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-5 pb-1.5">
      <hr className="flex-1 border-t border-[#E5E7EB]" />
      <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest whitespace-nowrap">
        {label}
      </span>
      <hr className="flex-1 border-t border-[#E5E7EB]" />
    </div>
  );
}

type NavCounts = {
  tenants: number;
  organizations: number;
  activeTenants: number;
};

function SuperAdminSidebar() {
  const pathname = usePathname();
  const [counts, setCounts] = useState<NavCounts | null>(null);

  useEffect(() => {
    fetch("/api/super-admin/overview")
      .then((r) => r.json())
      .then((data) => {
        setCounts({
          tenants: data.tenants?.total ?? 0,
          organizations: data.organizations?.total ?? 0,
          activeTenants: data.tenants?.active ?? 0,
        });
      })
      .catch(() => {});
  }, []);

  const platformItems = [
    {
      href: "/super-admin",
      label: "Overview",
      icon: <IconOverview />,
      badge: counts?.activeTenants,
      exact: true,
    },
    {
      href: "/super-admin/organizations",
      label: "Organizations",
      icon: <IconOrganization />,
      badge: counts?.organizations,
    },
    {
      href: "/super-admin/tenants",
      label: "Tenants",
      icon: <IconBuilding />,
      badge: counts?.tenants,
    },
    {
      href: "/super-admin/invitations",
      label: "Invitations",
      icon: <IconMail />,
    },
  ];

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-[240px] flex-shrink-0 flex flex-col bg-white border-r border-[#E5E7EB]">
      <div className="h-[60px] flex items-center px-5 gap-3 shrink-0 border-b border-[#E5E7EB]">
        <CertioraLogoMark />
        <div>
          <p className="font-semibold text-[14px] leading-none text-[#111827]">
            Certiora
          </p>
          <span className="inline-block mt-1 text-[10px] font-semibold text-primary bg-[#EEF2FF] rounded-full px-2 py-0.5">
            Super Admin
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        <SectionLabel label="Platform" />
        <div className="space-y-0.5 px-2">
          {platformItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
                  active
                    ? "bg-[#EEF2FF] text-primary font-semibold"
                    : "text-[#4B5563] font-medium hover:bg-[#F9FAFB] hover:text-[#111827]"
                }`}
              >
                <span className={active ? "text-primary" : "text-[#9CA3AF]"}>
                  {item.icon}
                </span>
                {item.label}
                <CountBadge count={item.badge} />
              </Link>
            );
          })}
        </div>

        <SectionLabel label="Account" />
        <div className="px-2">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors duration-150"
          >
            <span className="text-[#9CA3AF]">
              <IconLogOut />
            </span>
            Sign out
          </button>
        </div>
      </nav>
    </aside>
  );
}

export default function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="flex h-screen overflow-hidden">
        <SuperAdminSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto bg-surface-base">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}

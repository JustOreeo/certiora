"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

function CertioraLogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="9" fill="#4B4EFC" />
      <path d="M20 8L11 12V19C11 23.4 15 27.5 20 29C25 27.5 29 23.4 29 19V12L20 8Z" fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 19.5L18.5 22L24 17" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 9h.01M9 12h.01M9 15h.01M15 9h.01M15 12h.01M15 15h.01" strokeWidth="2" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
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

function SuperAdminSidebar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/super-admin/tenants", label: "Tenants", icon: <IconBuilding /> },
    { href: "/super-admin/invitations", label: "Invitations", icon: <IconMail /> },
  ];

  return (
    <aside className="w-[240px] flex-shrink-0 flex flex-col bg-surface-sidebar">
      {/* Brand */}
      <div className="h-[60px] flex items-center px-5 gap-3 shrink-0">
        <CertioraLogoMark />
        <div>
          <p className="font-semibold text-[14px] leading-none" style={{ color: "#FFFFFF" }}>Certiora</p>
          <p className="text-[11px] mt-0.5" style={{ color: "#6B6B85" }}>Super Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
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

      {/* Footer */}
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
  );
}

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { SessionProvider } from "next-auth/react";

function SuperAdminNav() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/super-admin/tenants", label: "Tenants" },
    { href: "/super-admin/invitations", label: "Invitations" },
  ];

  return (
    <nav className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-bold text-lg">Certiora</span>
        <span className="text-gray-400 text-sm">Super Admin</span>
        <div className="flex gap-4">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm px-3 py-1 rounded transition-colors ${
                pathname.startsWith(href)
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-sm text-gray-400 hover:text-white transition-colors"
      >
        Sign Out
      </button>
    </nav>
  );
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-gray-50">
        <SuperAdminNav />
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </div>
    </SessionProvider>
  );
}

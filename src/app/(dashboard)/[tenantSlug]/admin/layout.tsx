"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const tenantSlug = params.tenantSlug as string;

  const navItems = [
    { href: `/${tenantSlug}/admin/taxonomy`, label: "Taxonomy" },
    { href: `/${tenantSlug}/admin/questions`, label: "Questions" },
    { href: `/${tenantSlug}/admin/students`, label: "Students" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Admin Portal</h1>
            <div className="flex gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded ${
                    pathname === item.href
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}

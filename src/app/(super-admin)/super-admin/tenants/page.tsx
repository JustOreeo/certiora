"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TenantAdmin = { id: string; email: string; name: string | null };
type Tenant = {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  users: TenantAdmin[];
};

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/super-admin/tenants")
      .then((r) => r.json())
      .then((data) => { setTenants(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-semibold text-heading">Tenants</h1>
          <p className="text-sm text-secondary mt-0.5">All review centers on the platform</p>
        </div>
        <Link
          href="/super-admin/invitations"
          className="h-9 px-4 inline-flex items-center rounded-lg text-sm font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors"
        >
          + Invite admin
        </Link>
      </div>

      <div className="bg-surface-card border border-border rounded-xl shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner />
          </div>
        ) : tenants.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-secondary mb-4">
              No tenants yet. Invite an admin to create the first review center.
            </p>
            <Link
              href="/super-admin/invitations"
              className="inline-flex h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
            >
              Send invitation
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Slug</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Admin</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Created</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant, i) => (
                  <tr
                    key={tenant.id}
                    className={`${i > 0 ? "border-t border-border-subtle" : ""} hover:bg-surface-base transition-colors`}
                  >
                    <td className="px-5 py-3.5 text-sm font-medium text-body">{tenant.name}</td>
                    <td className="px-5 py-3.5 text-sm font-mono text-secondary">{tenant.slug}</td>
                    <td className="px-5 py-3.5 text-sm">
                      {tenant.users[0] ? (
                        <div>
                          <p className="text-body font-medium">{tenant.users[0].name}</p>
                          <p className="text-xs text-muted mt-0.5">{tenant.users[0].email}</p>
                        </div>
                      ) : (
                        <span className="text-muted italic text-xs">No admin yet</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-secondary">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

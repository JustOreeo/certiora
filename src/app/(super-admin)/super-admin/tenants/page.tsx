"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Tenant = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  isActive: boolean;
  suspendedAt: string | null;
  createdAt: string;
  organizationId: string | null;
  organization: { id: string; name: string } | null;
  _count: { users: number; courses: number };
  admin: { id: string; name: string | null; email: string } | null;
  lastActivity: string | null;
};

function Spinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <svg
        className="animate-spin text-muted"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          strokeOpacity="0.25"
        />
        <path
          d="M4 12a8 8 0 018-8"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-success-bg text-success border-success-border whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-success" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-error-bg text-error border-error-border whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-error" />
      Suspended
    </span>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function IconSearch() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

const selectClass =
  "h-9 px-3 pr-8 text-sm border border-border rounded-lg bg-surface-card text-body appearance-none cursor-pointer hover:border-border-strong focus:outline-none focus:border-border-focus transition-colors bg-[length:16px] bg-[right_8px_center] bg-no-repeat bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    fetch("/api/super-admin/tenants")
      .then((r) => r.json())
      .then((data) => {
        setTenants(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const organizations = useMemo(() => {
    const orgs = new Map<string, string>();
    tenants.forEach((t) => {
      if (t.organization) orgs.set(t.organization.id, t.organization.name);
    });
    return Array.from(orgs, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [tenants]);

  const filtered = useMemo(() => {
    let result = [...tenants];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q)
      );
    }

    if (statusFilter === "active") result = result.filter((t) => t.isActive);
    else if (statusFilter === "suspended")
      result = result.filter((t) => !t.isActive);

    if (orgFilter === "standalone")
      result = result.filter((t) => !t.organizationId);
    else if (orgFilter !== "all")
      result = result.filter((t) => t.organizationId === orgFilter);

    switch (sort) {
      case "oldest":
        result.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "students":
        result.sort((a, b) => b._count.users - a._count.users);
        break;
      default:
        result.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    return result;
  }, [tenants, search, statusFilter, orgFilter, sort]);

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-semibold text-heading">Tenants</h1>
          <p className="text-sm text-secondary mt-0.5">
            All review centers on the platform
          </p>
        </div>
        <Link
          href="/super-admin/invitations"
          className="h-9 px-4 inline-flex items-center rounded-lg text-sm font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors"
        >
          + Invite Admin
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <IconSearch />
          </div>
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm border border-border rounded-lg bg-surface-card text-body placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectClass}
        >
          <option value="all">Status: All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className={selectClass}
        >
          <option value="all">Organization: All</option>
          <option value="standalone">Standalone</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className={selectClass}
        >
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name">Name A–Z</option>
          <option value="students">Most Students</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface-card border border-border rounded-xl shadow-sm">
        {loading ? (
          <Spinner />
        ) : tenants.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#EEF2FF] flex items-center justify-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4B4EFC"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-bounce"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path
                  d="M9 9h.01M9 12h.01M9 15h.01M15 9h.01M15 12h.01M15 15h.01"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-heading mb-1">
              No review centers yet
            </p>
            <p className="text-sm text-secondary mb-5">
              Invite a review center admin to get started.
            </p>
            <Link
              href="/super-admin/invitations"
              className="inline-flex h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
            >
              Send first invitation →
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-secondary">
              No tenants match your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">
                    Review Center
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">
                    Admin
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">
                    Organization
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">
                    Courses
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">
                    Students
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">
                    Joined
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tenant, i) => (
                  <tr
                    key={tenant.id}
                    className={`${
                      i > 0 ? "border-t border-border-subtle" : ""
                    } hover:bg-surface-base transition-colors ${
                      !tenant.isActive ? "opacity-60" : ""
                    }`}
                  >
                    {/* Review Center */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {tenant.logoUrl ? (
                          <img
                            src={tenant.logoUrl}
                            alt={tenant.name}
                            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {getInitials(tenant.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-body truncate">
                            {tenant.name}
                          </p>
                          <p className="text-xs font-mono text-muted truncate">
                            {tenant.slug}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Admin */}
                    <td className="px-5 py-3.5 text-sm">
                      {tenant.admin ? (
                        <div>
                          <p className="text-body font-medium">
                            {tenant.admin.name ?? "—"}
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {tenant.admin.email}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted italic text-xs">
                          No admin yet
                        </span>
                      )}
                    </td>

                    {/* Organization */}
                    <td className="px-5 py-3.5 text-sm">
                      {tenant.organization ? (
                        <Link
                          href="/super-admin/organizations"
                          className="text-primary hover:text-primary-hover font-medium transition-colors"
                        >
                          {tenant.organization.name}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Courses */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#F3F4F6] text-secondary">
                        {tenant._count.courses} courses
                      </span>
                    </td>

                    {/* Students */}
                    <td className="px-5 py-3.5 text-sm font-medium text-body tabular-nums">
                      {tenant._count.users.toLocaleString()}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge active={tenant.isActive} />
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-3.5 text-sm text-secondary whitespace-nowrap">
                      {new Date(tenant.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/super-admin/tenants/${tenant.id}`}
                        className="inline-flex h-8 items-center px-3 rounded-lg text-xs font-medium border border-border text-body hover:bg-surface-base transition-colors"
                      >
                        View
                      </Link>
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

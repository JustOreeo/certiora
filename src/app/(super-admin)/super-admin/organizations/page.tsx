"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type OrgTenant = {
  id: string;
  slug: string;
  name: string;
  _count: { students: number };
};

type Organization = {
  id: string;
  name: string;
  logoUrl: string | null;
  createdAt: string;
  tenants: OrgTenant[];
};

type StandaloneTenant = {
  id: string;
  slug: string;
  name: string;
  _count: { users: number; courses: number };
};

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <svg
        className="animate-spin text-muted"
        width="24"
        height="24"
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

function SmallSpinner() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
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
  );
}

const inputClass =
  "h-9 px-3 text-sm border border-border rounded-lg bg-surface-card text-body placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors";

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [standaloneTenants, setStandaloneTenants] = useState<
    StandaloneTenant[]
  >([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  function loadData() {
    Promise.all([
      fetch("/api/super-admin/organizations").then((r) => r.json()),
      fetch("/api/super-admin/tenants?organizationId=standalone").then((r) =>
        r.json()
      ),
    ])
      .then(([orgs, tenants]) => {
        setOrganizations(orgs);
        setStandaloneTenants(tenants);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!menuOpenId) return;
    const handler = () => setMenuOpenId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpenId]);

  function startEdit(org: Organization) {
    setEditingId(org.id);
    setEditName(org.name);
    setEditLogoUrl(org.logoUrl ?? "");
    setEditError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError("");
  }

  async function saveEdit(orgId: string) {
    setEditSubmitting(true);
    setEditError("");
    const res = await fetch(`/api/super-admin/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        logoUrl: editLogoUrl || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setEditError(
        typeof data.error === "string" ? data.error : "Failed to update"
      );
      setEditSubmitting(false);
      return;
    }
    setEditingId(null);
    setEditSubmitting(false);
    loadData();
  }

  async function deleteOrg(orgId: string) {
    setDeleteSubmitting(true);
    await fetch(`/api/super-admin/organizations/${orgId}`, {
      method: "DELETE",
    });
    setDeletingId(null);
    setDeleteSubmitting(false);
    loadData();
  }

  if (loading) return <Spinner />;

  const hasContent = organizations.length > 0 || standaloneTenants.length > 0;

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-semibold text-heading">
            Organizations
          </h1>
          <p className="text-sm text-secondary mt-0.5">
            Review center brands with multiple branch locations
          </p>
        </div>
        <Link
          href="/super-admin/organizations/new"
          className="h-9 px-4 inline-flex items-center rounded-lg text-sm font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors"
        >
          + New Organization
        </Link>
      </div>

      {!hasContent ? (
        <div className="bg-surface-card border border-border rounded-xl shadow-sm px-6 py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F5F3FF] flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#7C3AED"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-bounce"
            >
              <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
              <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
              <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
              <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
            </svg>
          </div>
          <p className="text-sm font-medium text-heading mb-1">
            No organizations yet
          </p>
          <p className="text-sm text-secondary mb-5">
            Organizations group multiple branch locations under a single review
            center brand.
          </p>
          <Link
            href="/super-admin/organizations/new"
            className="inline-flex h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
          >
            Create first organization →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Organization groups */}
          {organizations.map((org) => (
            <div
              key={org.id}
              className="bg-surface-card border border-border rounded-xl shadow-sm overflow-hidden"
            >
              {/* Org header */}
              {editingId === org.id ? (
                <div className="px-5 py-4 space-y-3">
                  <p className="text-xs font-medium text-secondary uppercase tracking-wide">
                    Edit Organization
                  </p>
                  {editError && (
                    <div className="px-3 py-2 rounded-lg text-sm bg-error-bg border border-error-border text-error">
                      {editError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-secondary">
                        Organization name *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={200}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={inputClass}
                        placeholder="Organization name"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-secondary">
                        Logo URL
                      </label>
                      <input
                        type="url"
                        value={editLogoUrl}
                        onChange={(e) => setEditLogoUrl(e.target.value)}
                        className={inputClass}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={cancelEdit}
                      disabled={editSubmitting}
                      className="h-8 px-4 rounded-lg text-xs font-medium border border-border text-body hover:bg-surface-base transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveEdit(org.id)}
                      disabled={editSubmitting || !editName.trim()}
                      className="h-8 px-4 rounded-lg text-xs font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {editSubmitting && <SmallSpinner />}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {org.logoUrl ? (
                      <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] text-[#7C3AED] font-bold text-xs flex items-center justify-center">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-heading text-base">
                        {org.name}
                      </p>
                      <p className="text-xs text-muted">
                        {org.tenants.length}{" "}
                        {org.tenants.length === 1 ? "branch" : "branches"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(org)}
                      className="h-8 px-3 rounded-lg text-xs font-medium border border-border text-body hover:bg-surface-base transition-colors"
                    >
                      Edit
                    </button>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(
                            menuOpenId === org.id ? null : org.id
                          );
                        }}
                        className="h-8 w-8 rounded-lg flex items-center justify-center border border-border text-secondary hover:bg-surface-base transition-colors"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>
                      {menuOpenId === org.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-surface-card border border-border rounded-lg shadow-lg z-10 py-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(null);
                              setDeletingId(org.id);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error-bg transition-colors"
                          >
                            Delete Organization
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Delete confirmation */}
              {deletingId === org.id && (
                <div className="px-5 py-3 bg-error-bg border-t border-error-border flex items-center justify-between">
                  <p className="text-sm text-error">
                    Delete &ldquo;{org.name}&rdquo;?{" "}
                    {org.tenants.length > 0
                      ? `${org.tenants.length} ${org.tenants.length === 1 ? "tenant becomes" : "tenants become"} standalone (not deleted).`
                      : "No tenants are linked."}
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <button
                      onClick={() => setDeletingId(null)}
                      disabled={deleteSubmitting}
                      className="h-8 px-3 rounded-lg text-xs font-medium border border-border text-body bg-white hover:bg-surface-base transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deleteOrg(org.id)}
                      disabled={deleteSubmitting}
                      className="h-8 px-3 rounded-lg text-xs font-medium bg-error text-inverse hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {deleteSubmitting && <SmallSpinner />}
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Branch tenants */}
              {org.tenants.length > 0 && (
                <div className="border-t border-border-subtle">
                  {org.tenants.map((tenant, i) => (
                    <div
                      key={tenant.id}
                      className={`flex items-center gap-3 pl-6 pr-5 py-2.5 ${
                        i > 0 ? "border-t border-border-subtle" : ""
                      } hover:bg-surface-base transition-colors`}
                    >
                      <div className="w-px h-4 bg-border-strong flex-shrink-0 -ml-0.5" />
                      <Link
                        href={`/super-admin/tenants/${tenant.id}`}
                        className="text-sm text-body hover:text-primary transition-colors font-medium"
                      >
                        {tenant.name}
                      </Link>
                      <span className="text-xs font-mono text-muted">
                        {tenant.slug}
                      </span>
                      <span className="ml-auto text-xs text-secondary tabular-nums">
                        {tenant._count.students} students
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Standalone tenants */}
          {standaloneTenants.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest mb-3">
                Standalone Tenants (not in any organization)
              </p>
              <div className="bg-surface-card border border-border rounded-xl shadow-sm overflow-hidden">
                {standaloneTenants.map((tenant, i) => (
                  <div
                    key={tenant.id}
                    className={`flex items-center gap-3 px-5 py-2.5 ${
                      i > 0 ? "border-t border-border-subtle" : ""
                    } hover:bg-surface-base transition-colors`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-border-strong flex-shrink-0" />
                    <Link
                      href={`/super-admin/tenants/${tenant.id}`}
                      className="text-sm text-body hover:text-primary transition-colors font-medium"
                    >
                      {tenant.name}
                    </Link>
                    <span className="text-xs font-mono text-muted">
                      {tenant.slug}
                    </span>
                    <span className="ml-auto text-xs text-secondary tabular-nums">
                      {tenant._count.users} students
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

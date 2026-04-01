"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Invitation = {
  id: string;
  email: string;
  tenantName: string | null;
  tenantSlug: string | null;
  tenantId: string | null;
  token: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  inviter: { name: string; email: string } | null;
};

type NewInviteForm = {
  email: string;
  tenantName: string;
  tenantSlug: string;
  expiresInDays: number;
};

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function StatusBadge({ inv }: { inv: Invitation }) {
  if (inv.usedAt) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-success-bg text-success border-success-border">
        Used
      </span>
    );
  }
  if (new Date(inv.expiresAt) < new Date()) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-error-bg text-error border-error-border">
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-warning-bg text-warning border-warning-border">
      Pending
    </span>
  );
}

const inputClass = "h-10 px-3 text-sm border border-border rounded-lg bg-surface-card text-body placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors";

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<NewInviteForm>({ email: "", tenantName: "", tenantSlug: "", expiresInDays: 7 });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);

  const loadInvitations = () => {
    fetch("/api/super-admin/invitations")
      .then((r) => r.json())
      .then((data) => { setInvitations(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadInvitations(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    setGeneratedLink("");

    const res = await fetch("/api/super-admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = typeof data.error === "string" ? data.error : JSON.stringify(data.error?.fieldErrors ?? data.error);
      setFormError(msg);
      setSubmitting(false);
      return;
    }

    setGeneratedLink(`${window.location.origin}${data.invitationUrl}`);
    setForm({ email: "", tenantName: "", tenantSlug: "", expiresInDays: 7 });
    setSubmitting(false);
    loadInvitations();
  };

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const copyLink = async () => {
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyRowLink = async (inv: Invitation) => {
    const url = `${window.location.origin}/accept-invitation?token=${inv.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedRowId(inv.id);
    setTimeout(() => setCopiedRowId(null), 2000);
  };

  return (
    <div className="px-8 py-8 space-y-5">
      <div className="mb-7">
        <h1 className="text-[22px] font-semibold text-heading">Admin Invitations</h1>
        <p className="text-sm text-secondary mt-0.5">Invite review center admins to join the platform.</p>
      </div>

      {/* Create invitation card */}
      <div id="create-invitation" className="bg-surface-card border border-border rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-heading">Invite a new admin</h2>
          <p className="text-xs text-secondary mt-0.5">
            Creates a one-time invitation link for an admin to set up their review center.
          </p>
        </div>
        <div className="px-5 py-5">
          {formError && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg text-sm bg-error-bg border border-error-border text-error">
              {formError}
            </div>
          )}
          {generatedLink && (
            <div className="mb-5 rounded-lg bg-success-bg border border-success-border p-3.5">
              <p className="text-xs font-semibold text-success mb-2">Invitation created — share this link:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 block text-xs font-mono bg-surface-card border border-border rounded-lg px-3 py-2 break-all text-body">
                  {generatedLink}
                </code>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium bg-success text-white hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  <IconCopy />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">Admin email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
                placeholder="admin@reviewcenter.com"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">Expires in (days)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={form.expiresInDays}
                onChange={(e) => setForm({ ...form, expiresInDays: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">Review center name</label>
              <input
                type="text"
                required
                value={form.tenantName}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm({ ...form, tenantName: name, tenantSlug: autoSlug(name) });
                }}
                className={inputClass}
                placeholder="Excellence Review Center"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">Slug</label>
              <input
                type="text"
                required
                pattern="[a-z0-9-]+"
                value={form.tenantSlug}
                onChange={(e) => setForm({ ...form, tenantSlug: e.target.value })}
                className={`${inputClass} font-mono`}
                placeholder="excellence-review"
              />
              <p className="text-xs text-muted">Lowercase, numbers, hyphens only</p>
            </div>
            <div className="col-span-2 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-medium bg-primary text-inverse hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                {submitting ? <><Spinner /> Creating…</> : "Create invitation"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Invitations list */}
      <div className="bg-surface-card border border-border rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-heading">
            All invitations{" "}
            <span className="text-secondary font-normal">({invitations.length})</span>
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner />
          </div>
        ) : invitations.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-secondary mb-4">No invitations yet.</p>
            <a
              href="#create-invitation"
              className="inline-flex h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
            >
              Create invitation
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Tenant</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Expires</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Invited by</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide" />
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv, i) => (
                  <tr
                    key={inv.id}
                    className={`${i > 0 ? "border-t border-border-subtle" : ""} hover:bg-surface-base transition-colors`}
                  >
                    <td className="px-5 py-3.5 text-sm text-body">{inv.email}</td>
                    <td className="px-5 py-3.5 text-sm">
                      <p className="text-body font-medium">{inv.tenantName}</p>
                      <p className="text-xs font-mono text-muted mt-0.5">{inv.tenantSlug}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge inv={inv} />
                    </td>
                    <td className="px-5 py-3.5 text-sm text-secondary">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-secondary">
                      {inv.inviter ? (
                        <span title={inv.inviter.email}>{inv.inviter.name}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm">
                      <div className="flex items-center gap-3">
                        {!inv.usedAt && new Date(inv.expiresAt) >= new Date() && (
                          <button
                            onClick={() => copyRowLink(inv)}
                            className="inline-flex items-center gap-1.5 text-secondary hover:text-body font-medium transition-colors"
                          >
                            <IconCopy />
                            {copiedRowId === inv.id ? "Copied!" : "Copy link"}
                          </button>
                        )}
                        {inv.usedAt && inv.tenantId && (
                          <Link
                            href={`/super-admin/tenants/${inv.tenantId}`}
                            className="inline-flex items-center gap-1 text-primary hover:text-primary-hover font-medium transition-colors"
                          >
                            View tenant
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </Link>
                        )}
                      </div>
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

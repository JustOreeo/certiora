"use client";

import { useEffect, useState } from "react";

type Invitation = {
  id: string;
  email: string;
  tenantName: string | null;
  tenantSlug: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

type NewInviteForm = {
  email: string;
  tenantName: string;
  tenantSlug: string;
  expiresInDays: number;
};

function statusBadge(inv: Invitation) {
  if (inv.usedAt) {
    return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Used</span>;
  }
  if (new Date(inv.expiresAt) < new Date()) {
    return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Expired</span>;
  }
  return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">Pending</span>;
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<NewInviteForm>({
    email: "",
    tenantName: "",
    tenantSlug: "",
    expiresInDays: 7,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");

  const loadInvitations = () => {
    fetch("/api/super-admin/invitations")
      .then((r) => r.json())
      .then((data) => {
        setInvitations(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadInvitations();
  }, []);

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
      const msg =
        typeof data.error === "string"
          ? data.error
          : JSON.stringify(data.error?.fieldErrors ?? data.error);
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
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Admin Invitations</h1>

      {/* Create invitation form */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Invite a New Admin</h2>
        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {formError}
          </div>
        )}
        {generatedLink && (
          <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
            <p className="text-sm font-medium text-green-800 mb-2">Invitation created! Share this link:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border rounded px-3 py-2 text-sm break-all">
                {generatedLink}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(generatedLink)}
                className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 whitespace-nowrap"
              >
                Copy
              </button>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Admin Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="admin@reviewcenter.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Expires In (days)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={form.expiresInDays}
              onChange={(e) => setForm({ ...form, expiresInDays: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Review Center Name</label>
            <input
              type="text"
              required
              value={form.tenantName}
              onChange={(e) => {
                const name = e.target.value;
                setForm({ ...form, tenantName: name, tenantSlug: autoSlug(name) });
              }}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="e.g. Excellence Review Center"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug</label>
            <input
              type="text"
              required
              pattern="[a-z0-9-]+"
              value={form.tenantSlug}
              onChange={(e) => setForm({ ...form, tenantSlug: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
              placeholder="excellence-review"
            />
            <p className="text-xs text-gray-400 mt-1">Lowercase, numbers, hyphens only</p>
          </div>
          <div className="col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {submitting ? "Creating..." : "Create Invitation"}
            </button>
          </div>
        </form>
      </div>

      {/* Invitations list */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-semibold">All Admin Invitations</h2>
        </div>
        {loading ? (
          <p className="text-gray-500 p-4">Loading...</p>
        ) : invitations.length === 0 ? (
          <p className="text-gray-500 p-6 text-center">No invitations yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tenant</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invitations.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{inv.email}</td>
                  <td className="px-4 py-3">
                    <div>{inv.tenantName}</div>
                    <div className="text-gray-400 font-mono text-xs">{inv.tenantSlug}</div>
                  </td>
                  <td className="px-4 py-3">{statusBadge(inv)}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

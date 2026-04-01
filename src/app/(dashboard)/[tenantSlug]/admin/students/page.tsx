"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toUserMessage } from "@/lib/errors";

type Student = {
  id: string;
  email: string;
  name: string;
  credentialsExpiresAt: string;
  createdAt: string;
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

function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 17 12 21 16 17" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
    </svg>
  );
}

export default function StudentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [credentials, setCredentials] = useState<
    Array<{ studentId: string; name: string; username: string; password: string }>
  >([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState(30);
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<Array<{
    id: string; email: string; token: string; expiresAt: string; usedAt: string | null; createdAt: string;
    inviter: { name: string; email: string } | null;
  }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      loadStudents();
      loadInvitations();
    }
  }, [status, router]);

  const loadStudents = async () => {
    try {
      const res = await fetch("/api/admin/students");
      const data = await res.json();
      setStudents(data.items || []);
    } catch (error) {
      console.error("Failed to load students:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    try {
      const res = await fetch(`/api/${params.tenantSlug}/admin/invitations`);
      const data = await res.json();
      setPendingInvites(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load invitations:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/students/bulk", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setCredentials(data.students || []);
        loadStudents();
      } else {
        alert(toUserMessage(data, "Upload failed. Please check the file and try again."));
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert(toUserMessage(error, "Upload failed. Please try again."));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleInviteStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteError("");
    setInviteLink("");

    const res = await fetch(`/api/${params.tenantSlug}/admin/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, expiresInDays: inviteExpiresInDays }),
    });

    const data = await res.json();

    if (!res.ok) {
      setInviteError(toUserMessage(data, "Failed to create invitation."));
      setInviting(false);
      return;
    }

    setInviteLink(`${window.location.origin}${data.invitationUrl}`);
    setInviteEmail("");
    setInviting(false);
    loadInvitations();
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyRowLink = async (inv: { id: string; token: string }) => {
    const url = `${window.location.origin}/accept-invitation?token=${inv.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedRowId(inv.id);
    setTimeout(() => setCopiedRowId(null), 2000);
  };

  const revokeInvitation = async (id: string, email: string) => {
    if (!confirm(`Revoke invitation for ${email}?`)) return;
    setRevoking(id);
    await fetch(`/api/${params.tenantSlug}/admin/invitations/${id}`, { method: "DELETE" });
    setRevoking(null);
    loadInvitations();
  };

  const downloadCredentials = () => {
    const csv = [
      ["Student ID", "Name", "Username", "Password"].join(","),
      ...credentials.map((c) => [c.studentId, c.name, c.username, c.password].join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student-credentials.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-semibold text-heading">Students</h1>
          <p className="text-sm text-secondary mt-0.5">{students.length} enrolled</p>
        </div>
        <label
          className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            uploading
              ? "bg-border text-secondary"
              : "bg-primary text-inverse hover:bg-primary-hover"
          }`}
        >
          {uploading ? <Spinner /> : <IconUpload />}
          {uploading ? "Uploading…" : "Upload CSV"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      {/* Invite student card */}
      <div id="invite-student" className="bg-surface-card border border-border rounded-xl shadow-sm mb-5">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-heading">Invite a student</h2>
          <p className="text-xs text-secondary mt-0.5">
            Send an invitation link that the student uses to create their account.
          </p>
        </div>
        <div className="px-5 py-4">
          {inviteError && (
            <div className="mb-3 px-3.5 py-2.5 rounded-lg text-sm bg-error-bg border border-error-border text-error">
              {inviteError}
            </div>
          )}
          {inviteLink && (
            <div className="mb-4 rounded-lg bg-success-bg border border-success-border p-3.5">
              <p className="text-xs font-semibold text-success mb-2">Invitation created — share this link:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 block text-xs font-mono bg-surface-card border border-border rounded-lg px-3 py-2 break-all text-body">
                  {inviteLink}
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
          <form onSubmit={handleInviteStudent} className="flex gap-2">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="student@example.com"
              className="flex-1 h-10 px-3 text-sm border border-border rounded-lg bg-surface-card text-body placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors"
            />
            <input
              type="number"
              min={1}
              max={90}
              value={inviteExpiresInDays}
              onChange={(e) => setInviteExpiresInDays(Number(e.target.value))}
              title="Expires in (days)"
              className="w-20 h-10 px-3 text-sm border border-border rounded-lg bg-surface-card text-body focus:outline-none focus:border-border-focus transition-colors"
            />
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium bg-primary text-inverse hover:bg-primary-hover disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {inviting ? <><Spinner /> Sending…</> : "Send invitation"}
            </button>
          </form>
        </div>
      </div>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div className="bg-surface-card border border-border rounded-xl shadow-sm mb-5">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-sm font-semibold text-heading">
              Pending invitations{" "}
              <span className="text-secondary font-normal">({pendingInvites.filter(i => !i.usedAt && new Date(i.expiresAt) >= new Date()).length})</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Expires</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Invited by</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide" />
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((inv, i) => {
                  const isExpired = new Date(inv.expiresAt) < new Date();
                  const isPending = !inv.usedAt && !isExpired;
                  return (
                    <tr key={inv.id} className={`${i > 0 ? "border-t border-border-subtle" : ""} hover:bg-surface-base transition-colors`}>
                      <td className="px-5 py-3.5 text-sm text-body">{inv.email}</td>
                      <td className="px-5 py-3.5">
                        {inv.usedAt ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-success-bg text-success border-success-border">Used</span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-error-bg text-error border-error-border">Expired</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-warning-bg text-warning border-warning-border">Pending</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-secondary">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 text-sm text-secondary">
                        {inv.inviter ? (
                          <span title={inv.inviter.email}>{inv.inviter.name}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm">
                        {isPending && (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => copyRowLink(inv)}
                              className="inline-flex items-center gap-1.5 text-secondary hover:text-body font-medium transition-colors"
                            >
                              <IconCopy />
                              {copiedRowId === inv.id ? "Copied!" : "Copy link"}
                            </button>
                            <button
                              onClick={() => revokeInvitation(inv.id, inv.email)}
                              disabled={revoking === inv.id}
                              className="inline-flex items-center gap-1 text-error hover:opacity-75 font-medium transition-opacity disabled:opacity-50"
                            >
                              {revoking === inv.id ? <Spinner /> : null}
                              Revoke
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generated credentials (after CSV upload) */}
      {credentials.length > 0 && (
        <div className="bg-surface-card border border-border rounded-xl shadow-sm mb-5">
          <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-heading">Generated credentials</h2>
              <p className="text-xs text-secondary mt-0.5">{credentials.length} students added</p>
            </div>
            <button
              onClick={downloadCredentials}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg bg-surface-base border border-border text-body hover:border-border-strong transition-colors"
            >
              <IconDownload />
              Download CSV
            </button>
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Student ID</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Username</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Password</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((c, i) => (
                  <tr key={i} className="border-t border-border-subtle">
                    <td className="px-5 py-3 text-sm text-body">{c.studentId}</td>
                    <td className="px-5 py-3 text-sm text-body">{c.name}</td>
                    <td className="px-5 py-3 text-sm text-body">{c.username}</td>
                    <td className="px-5 py-3 text-sm">
                      <code className="font-mono bg-surface-base px-2 py-0.5 rounded text-xs text-body">{c.password}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CSV format helper */}
      <div className="bg-info-bg border border-info-border rounded-xl px-5 py-4 mb-5">
        <p className="text-xs font-semibold text-info mb-2">CSV format</p>
        <pre className="text-xs font-mono text-body bg-surface-card border border-border rounded-lg px-3 py-2.5 whitespace-pre-wrap">
          {"studentId,name,email,credentialsExpiresAt\n2024001,John Doe,john@example.com,2024-12-31\n2024002,Jane Smith,,2024-12-31"}
        </pre>
        <p className="text-xs text-secondary mt-2">If email is empty, we'll use studentId@student.local</p>
      </div>

      {/* Students table */}
      <div className="bg-surface-card border border-border rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-heading">
            All students{" "}
            <span className="text-secondary font-normal">({students.length})</span>
          </h2>
        </div>
        {students.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-secondary mb-4">
              No students yet. Invite a student by email or upload a CSV to add many at once.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="#invite-student"
                className="inline-flex h-10 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
              >
                Invite student
              </a>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-surface-base border border-border text-body hover:border-border-strong transition-colors disabled:opacity-60"
              >
                {uploading ? <Spinner /> : <IconUpload />}
                Upload CSV
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Expires</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Enrolled</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wide">Performance</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`${i > 0 ? "border-t border-border-subtle" : ""} hover:bg-surface-base transition-colors`}
                  >
                    <td className="px-5 py-3.5 text-sm font-medium text-body">{s.name}</td>
                    <td className="px-5 py-3.5 text-sm text-secondary">{s.email}</td>
                    <td className="px-5 py-3.5 text-sm text-secondary">
                      {s.credentialsExpiresAt
                        ? new Date(s.credentialsExpiresAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-secondary">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/${params.tenantSlug}/admin/analytics/students/${s.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        View performance
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

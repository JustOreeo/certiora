"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────

type TenantDetail = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  customDomain: string | null;
  isActive: boolean;
  suspendedAt: string | null;
  createdAt: string;
  settings: unknown;
  organizationId: string | null;
  organization: { id: string; name: string } | null;
  admin: { id: string; name: string | null; email: string } | null;
  _count: {
    students: number;
    courses: number;
    examAttempts: number;
    questions: number;
  };
  activity30d: {
    examsTaken: number;
    activeStudents: number;
    flashcardReviews: number;
    lastExamAt: string | null;
  };
};

type Course = {
  id: string;
  name: string;
  description: string | null;
  targetExamDate: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { students: number };
};

type Student = {
  id: string;
  name: string | null;
  email: string;
  studentId: string | null;
  createdAt: string;
  course: { id: string; name: string } | null;
};

type OrgOption = { id: string; name: string };
type TabId = "overview" | "courses" | "students";

// ── Shared helpers ─────────────────────────────────────────────────────────

const inputClass =
  "h-9 px-3 text-sm border border-border rounded-lg bg-surface-card text-body placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors w-full";

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <svg className="animate-spin text-muted" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function SmallSpinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-success-bg text-success border-success-border">
      <span className="w-1.5 h-1.5 rounded-full bg-success" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-error-bg text-error border-error-border">
      <span className="w-1.5 h-1.5 rounded-full bg-error" /> Suspended
    </span>
  );
}

function CourseStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-success-bg text-success border border-success-border">● Active</span>
  ) : (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#F3F4F6] text-[#6B7280] border border-border">○ Inactive</span>
  );
}

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="bg-surface-card border border-border rounded-xl px-4 py-2 flex items-center gap-2 text-sm">
      <span className="text-muted">{icon}</span>
      <span className="font-semibold text-heading tabular-nums">{value.toLocaleString()}</span>
      <span className="text-muted">{label}</span>
    </div>
  );
}

function InfoRow({ label, value, mono, link, color, badge, last }: {
  label: string; value: string; mono?: boolean; link?: string; color?: string; badge?: React.ReactNode; last?: boolean;
}) {
  const valueContent = badge ?? (
    <span className={`text-body font-medium ${mono ? "font-mono text-sm" : ""}`}>
      {color && <span className="inline-block w-3 h-3 rounded-sm mr-2 border border-border align-middle" style={{ backgroundColor: color }} />}
      {link ? <Link href={link} className="text-primary hover:text-primary-hover transition-colors">{value}</Link> : value}
    </span>
  );
  return (
    <div className={`flex justify-between items-center py-2.5 text-sm ${!last ? "border-b border-border-subtle" : ""}`}>
      <span className="text-muted">{label}</span>
      {valueContent}
    </div>
  );
}

// ── Stat icons ─────────────────────────────────────────────────────────────

function IconStudents() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
}
function IconCourses() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /><path d="M8 7h6M8 11h4" /></svg>);
}
function IconExams() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M9 15h6M9 11h6" /></svg>);
}
function IconQuestions() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>);
}
function IconSearch() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>);
}

// ── Edit Tenant Slide-Over (Phase 8) ───────────────────────────────────────

function EditTenantSlideOver({ tenant, open, onClose, onSaved }: {
  tenant: TenantDetail; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [name, setName] = useState(tenant.name);
  const [slug, setSlug] = useState(tenant.slug);
  const [orgId, setOrgId] = useState(tenant.organizationId ?? "");
  const [customDomain, setCustomDomain] = useState(tenant.customDomain ?? "");
  const [primaryColor, setPrimaryColor] = useState(tenant.primaryColor ?? "#4B4EFC");
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(tenant.name);
    setSlug(tenant.slug);
    setOrgId(tenant.organizationId ?? "");
    setCustomDomain(tenant.customDomain ?? "");
    setPrimaryColor(tenant.primaryColor ?? "#4B4EFC");
    setLogoUrl(tenant.logoUrl ?? "");
    setError("");
    fetch("/api/super-admin/organizations")
      .then((r) => r.json())
      .then((data) => setOrgs(data.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name }))))
      .catch(() => {});
  }, [open, tenant]);

  if (!open) return null;

  const slugChanged = slug !== tenant.slug;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const body: Record<string, unknown> = {
      name,
      slug,
      customDomain: customDomain || null,
      primaryColor: primaryColor || null,
      logoUrl: logoUrl || null,
      organizationId: orgId || null,
    };
    const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : JSON.stringify(data.error?.fieldErrors ?? data.error));
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/30 transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col overflow-y-auto">
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-lg font-semibold text-heading">Edit Tenant</h2>
        </div>
        <form onSubmit={handleSave} className="flex-1 px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg text-sm bg-error-bg border border-error-border text-error">{error}</div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-secondary">Tenant name *</label>
            <input type="text" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-secondary">Tenant slug *</label>
            <input type="text" required pattern="[a-z0-9-]+" value={slug} onChange={(e) => setSlug(e.target.value)} className={`${inputClass} font-mono`} />
            {slugChanged && (
              <p className="text-xs text-warning">Changing the slug will break any existing bookmarks to /{tenant.slug}/*. Make sure the admin is aware.</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-secondary">Organization</label>
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={inputClass}>
              <option value="">None (Standalone)</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-secondary">Custom domain</label>
            <input type="text" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} className={inputClass} placeholder="rc.example.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-secondary">Primary color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-9 h-9 rounded-lg border border-border cursor-pointer p-0.5" />
              <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className={`${inputClass} font-mono`} placeholder="#4B4EFC" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-secondary">Logo URL</label>
            <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className={inputClass} placeholder="https://..." />
          </div>
          <div className="flex items-center gap-3 pt-3">
            <button type="button" onClick={onClose} disabled={submitting} className="h-9 px-4 rounded-lg text-sm font-medium border border-border text-body hover:bg-surface-base transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={submitting || !name.trim() || !slug.trim()} className="h-9 px-5 rounded-lg text-sm font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors disabled:opacity-50 inline-flex items-center gap-2">
              {submitting && <SmallSpinner />} Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ tenant }: { tenant: TenantDetail }) {
  return (
    <div className="py-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h3 className="text-sm font-semibold text-heading">Tenant Information</h3>
          </div>
          <div className="px-5 py-1">
            <InfoRow label="Name" value={tenant.name} />
            <InfoRow label="Slug" value={tenant.slug} mono />
            <InfoRow label="Organization" value={tenant.organization?.name ?? "Standalone"} link={tenant.organization ? "/super-admin/organizations" : undefined} />
            <InfoRow label="Custom domain" value={tenant.customDomain ?? "—"} />
            <InfoRow label="Primary color" value={tenant.primaryColor ?? "—"} color={tenant.primaryColor ?? undefined} />
            <InfoRow label="Admin" value={tenant.admin ? `${tenant.admin.name ?? "—"} · ${tenant.admin.email}` : "No admin"} />
            <InfoRow label="Created" value={new Date(tenant.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
            <InfoRow label="Status" value={tenant.isActive ? "Active" : "Suspended"} badge={<StatusBadge active={tenant.isActive} />} last />
          </div>
        </div>
        <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h3 className="text-sm font-semibold text-heading">Activity (last 30 days)</h3>
          </div>
          <div className="px-5 py-1">
            <InfoRow label="Exams taken" value={tenant.activity30d.examsTaken.toLocaleString()} />
            <InfoRow label="Active students" value={tenant.activity30d.activeStudents.toLocaleString()} />
            <InfoRow label="Flashcard reviews" value={tenant.activity30d.flashcardReviews.toLocaleString()} />
            <InfoRow label="Last exam attempt" value={tenant.activity30d.lastExamAt ? timeAgo(tenant.activity30d.lastExamAt) : "Never"} last />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Courses Tab (Phase 9) ──────────────────────────────────────────────────

function CoursesTab({ tenantId }: { tenantId: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  // Form state (shared for add/edit)
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadCourses = useCallback(() => {
    fetch(`/api/super-admin/tenants/${tenantId}/courses`)
      .then((r) => r.json())
      .then(setCourses)
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  function resetForm() {
    setFormName(""); setFormDesc(""); setFormDate(""); setFormActive(true); setFormError("");
  }

  function startAdd() {
    setEditingId(null); resetForm(); setShowAdd(true);
  }

  function startEdit(c: Course) {
    setShowAdd(false);
    setEditingId(c.id);
    setFormName(c.name);
    setFormDesc(c.description ?? "");
    setFormDate(c.targetExamDate ? c.targetExamDate.slice(0, 10) : "");
    setFormActive(c.isActive);
    setFormError("");
  }

  function cancelForm() {
    setShowAdd(false); setEditingId(null); resetForm();
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormSubmitting(true); setFormError("");
    const res = await fetch(`/api/super-admin/tenants/${tenantId}/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formName, description: formDesc || null, targetExamDate: formDate || null }),
    });
    if (!res.ok) {
      const d = await res.json();
      setFormError(typeof d.error === "string" ? d.error : "Failed to create");
      setFormSubmitting(false); return;
    }
    setFormSubmitting(false); cancelForm(); loadCourses();
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setFormSubmitting(true); setFormError("");
    const res = await fetch(`/api/super-admin/tenants/${tenantId}/courses/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formName, description: formDesc || null, targetExamDate: formDate || null, isActive: formActive }),
    });
    if (!res.ok) {
      const d = await res.json();
      setFormError(typeof d.error === "string" ? d.error : "Failed to update");
      setFormSubmitting(false); return;
    }
    setFormSubmitting(false); cancelForm(); loadCourses();
  }

  async function deleteCourse(courseId: string) {
    setDeleteError("");
    const res = await fetch(`/api/super-admin/tenants/${tenantId}/courses/${courseId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setDeleteError(typeof d.error === "string" ? d.error : "Failed to delete");
      setDeletingId(null); return;
    }
    setDeletingId(null); loadCourses();
  }

  useEffect(() => {
    if (!deletingId) return;
    const t = setTimeout(() => setDeletingId(null), 5000);
    return () => clearTimeout(t);
  }, [deletingId]);

  if (loading) return <div className="py-10 flex justify-center"><SmallSpinner /></div>;

  const courseForm = (onSubmit: (e: React.FormEvent) => void, buttonLabel: string) => (
    <form onSubmit={onSubmit} className="bg-surface-card border border-border rounded-xl p-5 space-y-3">
      <p className="text-xs font-semibold text-heading uppercase tracking-wide">{editingId ? "Edit Course" : "Add Course"}</p>
      {formError && <div className="px-3 py-2 rounded-lg text-sm bg-error-bg border border-error-border text-error">{formError}</div>}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-secondary">Course name *</label>
        <input type="text" required maxLength={150} value={formName} onChange={(e) => setFormName(e.target.value)} className={inputClass} placeholder="e.g., 2026 Nursing Board Review" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-secondary">Description</label>
        <textarea maxLength={500} rows={2} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className={`${inputClass} h-auto py-2`} placeholder="Optional description" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-secondary">Target exam date</label>
        <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className={inputClass} />
      </div>
      {editingId && (
        <div className="flex items-center gap-2">
          <input type="checkbox" id="course-active" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} className="rounded border-border" />
          <label htmlFor="course-active" className="text-xs font-medium text-secondary">Active</label>
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button type="button" onClick={cancelForm} disabled={formSubmitting} className="h-8 px-4 rounded-lg text-xs font-medium border border-border text-body hover:bg-surface-base transition-colors disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={formSubmitting || !formName.trim()} className="h-8 px-4 rounded-lg text-xs font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors disabled:opacity-50 inline-flex items-center gap-1.5">
          {formSubmitting && <SmallSpinner />} {buttonLabel}
        </button>
      </div>
    </form>
  );

  return (
    <div className="py-6 space-y-4">
      {deleteError && (
        <div className="px-4 py-3 rounded-lg text-sm bg-error-bg border border-error-border text-error">{deleteError}</div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-heading">Courses ({courses.length})</h3>
        {!showAdd && !editingId && (
          <button onClick={startAdd} className="h-8 px-3 rounded-lg text-xs font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors">+ Add Course</button>
        )}
      </div>

      {showAdd && courseForm(submitAdd, "Add Course")}

      {courses.length === 0 && !showAdd ? (
        <div className="bg-surface-card border border-border rounded-xl px-6 py-12 text-center">
          <p className="text-sm font-medium text-heading mb-1">No courses added yet.</p>
          <p className="text-sm text-secondary mb-5">Courses represent the study programs this review center runs (e.g., &ldquo;2026 Nursing Board Review&rdquo;).</p>
          <button onClick={startAdd} className="inline-flex h-9 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors">+ Add First Course</button>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((c) =>
            editingId === c.id ? (
              <div key={c.id}>{courseForm(submitEdit, "Save Changes")}</div>
            ) : (
              <div key={c.id} className="bg-surface-card border border-border rounded-xl px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-heading text-sm">{c.name}</span>
                      <span className="text-xs text-secondary">{c._count.students} students</span>
                      <span className="text-xs text-secondary">
                        {c.targetExamDate
                          ? new Date(c.targetExamDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                          : "TBD"}
                      </span>
                      <CourseStatusBadge active={c.isActive} />
                    </div>
                    {c.description && (
                      <p className="text-sm text-secondary italic mt-1 truncate">{c.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {deletingId === c.id ? (
                      <>
                        <span className="text-xs text-error">Are you sure?</span>
                        <button onClick={() => deleteCourse(c.id)} className="h-7 px-2.5 rounded-md text-xs font-medium bg-error text-inverse hover:opacity-90 transition-opacity">Delete</button>
                        <button onClick={() => setDeletingId(null)} className="h-7 px-2.5 rounded-md text-xs font-medium border border-border text-body hover:bg-surface-base transition-colors">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(c)} className="h-7 px-2.5 rounded-md text-xs font-medium border border-border text-body hover:bg-surface-base transition-colors">Edit</button>
                        <button onClick={() => setDeletingId(c.id)} className="h-7 px-2.5 rounded-md text-xs font-medium border border-border text-secondary hover:text-error hover:border-error-border transition-colors">Delete</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Students Tab (Phase 10) ────────────────────────────────────────────────

const selectClass =
  "h-9 px-3 pr-8 text-sm border border-border rounded-lg bg-surface-card text-body appearance-none cursor-pointer hover:border-border-strong focus:outline-none focus:border-border-focus transition-colors bg-[length:16px] bg-[right_8px_center] bg-no-repeat bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]";

function StudentsTab({ tenantId }: { tenantId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch(`/api/super-admin/tenants/${tenantId}/courses`)
      .then((r) => r.json())
      .then((data: Course[]) => setCourses(data.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, [tenantId]);

  const loadStudents = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    if (courseFilter) params.set("courseId", courseFilter);
    fetch(`/api/super-admin/tenants/${tenantId}/students?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setStudents(data.students);
        setTotal(data.total);
        setPages(data.pages);
      })
      .finally(() => setLoading(false));
  }, [tenantId, page, search, courseFilter]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // Reset to page 1 when filters change
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleCourse = (v: string) => { setCourseFilter(v); setPage(1); };

  return (
    <div className="py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-heading">Students ({total})</h3>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none"><IconSearch /></div>
            <input type="text" placeholder="Search..." value={search} onChange={(e) => handleSearch(e.target.value)} className="h-9 pl-9 pr-3 text-sm border border-border rounded-lg bg-surface-card text-body placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors w-48" />
          </div>
          <select value={courseFilter} onChange={(e) => handleCourse(e.target.value)} className={selectClass}>
            <option value="">Course: All</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-surface-card border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><SmallSpinner /></div>
        ) : students.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-secondary">{search || courseFilter ? "No students match your filters." : "No students in this tenant yet."}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Email</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Course</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wide">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id} className={`${i > 0 ? "border-t border-border-subtle" : ""} hover:bg-surface-base transition-colors`}>
                      <td className="px-5 py-3 text-sm font-medium text-heading">{s.name ?? "Anonymous"}</td>
                      <td className="px-5 py-3 text-sm text-secondary">{s.email}</td>
                      <td className="px-5 py-3 text-sm text-body">{s.course?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-sm text-secondary whitespace-nowrap">
                        {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle">
                <span className="text-xs text-muted">Page {page} of {pages}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="h-8 px-3 rounded-lg text-xs font-medium border border-border text-body hover:bg-surface-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
                  <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="h-8 px-3 rounded-lg text-xs font-medium border border-border text-body hover:bg-surface-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [editOpen, setEditOpen] = useState(false);

  const loadTenant = useCallback(() => {
    fetch(`/api/super-admin/tenants/${tenantId}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then((data) => setTenant(data))
      .catch(() => setError("Tenant not found"))
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => { loadTenant(); }, [loadTenant]);

  if (loading) return <Spinner />;

  if (error || !tenant) {
    return (
      <div className="px-8 py-8">
        <Link href="/super-admin/tenants" className="inline-flex items-center gap-1 text-sm text-secondary hover:text-heading transition-colors mb-5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Back to Tenants
        </Link>
        <p className="text-sm text-error">{error || "Tenant not found"}</p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "courses", label: "Courses" },
    { id: "students", label: "Students" },
  ];

  return (
    <div className="px-8 py-8">
      <Link href="/super-admin/tenants" className="inline-flex items-center gap-1 text-sm text-secondary hover:text-heading transition-colors mb-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        Back to Tenants
      </Link>

      {/* Page header */}
      <div className="flex items-start gap-5 mb-6">
        {tenant.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenant.name} className="w-14 h-14 rounded-2xl object-cover border border-border flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary font-bold text-lg flex items-center justify-center border border-border flex-shrink-0">
            {getInitials(tenant.name)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-heading truncate">{tenant.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="font-mono text-sm text-muted">{tenant.slug}</span>
            <span className="text-border-strong">·</span>
            <StatusBadge active={tenant.isActive} />
            <span className="text-border-strong">·</span>
            <span className="text-sm text-muted">Joined {new Date(tenant.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => setEditOpen(true)} className="h-8 px-3 rounded-lg text-xs font-medium border border-border text-body hover:bg-surface-base transition-colors">Edit Tenant</button>
            <button
              onClick={() => { /* Phase 11: suspend/reactivate */ }}
              className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${tenant.isActive ? "border border-error-border text-error hover:bg-error-bg" : "bg-success text-inverse hover:opacity-90"}`}
            >
              {tenant.isActive ? "Suspend Tenant" : "Reactivate Tenant"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex flex-wrap gap-3 mb-6">
        <StatChip icon={<IconStudents />} value={tenant._count.students} label="Students" />
        <StatChip icon={<IconCourses />} value={tenant._count.courses} label="Courses" />
        <StatChip icon={<IconExams />} value={tenant._count.examAttempts} label="Exams" />
        <StatChip icon={<IconQuestions />} value={tenant._count.questions} label="Questions" />
      </div>

      {/* Tab navigation */}
      <div className="border-b border-border mb-0">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === tab.id ? "text-primary font-semibold" : "text-secondary hover:text-heading"}`}>
              {tab.label}
              {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab tenant={tenant} />}
      {activeTab === "courses" && <CoursesTab tenantId={tenantId} />}
      {activeTab === "students" && <StudentsTab tenantId={tenantId} />}

      {/* Edit Tenant Slide-Over */}
      <EditTenantSlideOver tenant={tenant} open={editOpen} onClose={() => setEditOpen(false)} onSaved={loadTenant} />
    </div>
  );
}

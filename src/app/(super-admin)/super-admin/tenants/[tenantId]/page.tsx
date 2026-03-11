"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

type TabId = "overview" | "courses" | "students";

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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-success-bg text-success border-success-border">
      <span className="w-1.5 h-1.5 rounded-full bg-success" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-error-bg text-error border-error-border">
      <span className="w-1.5 h-1.5 rounded-full bg-error" />
      Suspended
    </span>
  );
}

function StatChip({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="bg-surface-card border border-border rounded-xl px-4 py-2 flex items-center gap-2 text-sm">
      <span className="text-muted">{icon}</span>
      <span className="font-semibold text-heading tabular-nums">
        {value.toLocaleString()}
      </span>
      <span className="text-muted">{label}</span>
    </div>
  );
}

function IconStudents() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconCourses() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h6M8 11h4" />
    </svg>
  );
}

function IconExams() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M9 15h6M9 11h6" />
    </svg>
  );
}

function IconQuestions() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// -- Tab content placeholders (Phases 8-10 replace these) --

function OverviewTab({ tenant }: { tenant: TenantDetail }) {
  return (
    <div className="py-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tenant Info Card */}
        <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h3 className="text-sm font-semibold text-heading">
              Tenant Information
            </h3>
          </div>
          <div className="px-5 py-1">
            <InfoRow label="Name" value={tenant.name} />
            <InfoRow label="Slug" value={tenant.slug} mono />
            <InfoRow
              label="Organization"
              value={tenant.organization?.name ?? "Standalone"}
              link={
                tenant.organization
                  ? "/super-admin/organizations"
                  : undefined
              }
            />
            <InfoRow label="Custom domain" value={tenant.customDomain ?? "—"} />
            <InfoRow
              label="Primary color"
              value={tenant.primaryColor ?? "—"}
              color={tenant.primaryColor ?? undefined}
            />
            <InfoRow
              label="Admin"
              value={
                tenant.admin
                  ? `${tenant.admin.name ?? "—"} · ${tenant.admin.email}`
                  : "No admin"
              }
            />
            <InfoRow
              label="Created"
              value={new Date(tenant.createdAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            />
            <InfoRow
              label="Status"
              value={tenant.isActive ? "Active" : "Suspended"}
              badge={<StatusBadge active={tenant.isActive} />}
              last
            />
          </div>
        </div>

        {/* Activity Card */}
        <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h3 className="text-sm font-semibold text-heading">
              Activity (last 30 days)
            </h3>
          </div>
          <div className="px-5 py-1">
            <InfoRow
              label="Exams taken"
              value={tenant.activity30d.examsTaken.toLocaleString()}
            />
            <InfoRow
              label="Active students"
              value={tenant.activity30d.activeStudents.toLocaleString()}
            />
            <InfoRow
              label="Flashcard reviews"
              value={tenant.activity30d.flashcardReviews.toLocaleString()}
            />
            <InfoRow
              label="Last exam attempt"
              value={
                tenant.activity30d.lastExamAt
                  ? timeAgo(tenant.activity30d.lastExamAt)
                  : "Never"
              }
              last
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CoursesTab({ tenantId }: { tenantId: string }) {
  return (
    <div className="py-6 text-center text-sm text-muted">
      <p>Courses tab — implemented in Phase 9</p>
      <p className="text-xs mt-1">Tenant: {tenantId}</p>
    </div>
  );
}

function StudentsTab({ tenantId }: { tenantId: string }) {
  return (
    <div className="py-6 text-center text-sm text-muted">
      <p>Students tab — implemented in Phase 10</p>
      <p className="text-xs mt-1">Tenant: {tenantId}</p>
    </div>
  );
}

// -- Shared helpers --

function timeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function InfoRow({
  label,
  value,
  mono,
  link,
  color,
  badge,
  last,
}: {
  label: string;
  value: string;
  mono?: boolean;
  link?: string;
  color?: string;
  badge?: React.ReactNode;
  last?: boolean;
}) {
  const valueContent = badge ?? (
    <span
      className={`text-body font-medium ${mono ? "font-mono text-sm" : ""}`}
    >
      {color && (
        <span
          className="inline-block w-3 h-3 rounded-sm mr-2 border border-border align-middle"
          style={{ backgroundColor: color }}
        />
      )}
      {link ? (
        <Link
          href={link}
          className="text-primary hover:text-primary-hover transition-colors"
        >
          {value}
        </Link>
      ) : (
        value
      )}
    </span>
  );

  return (
    <div
      className={`flex justify-between items-center py-2.5 text-sm ${
        !last ? "border-b border-border-subtle" : ""
      }`}
    >
      <span className="text-muted">{label}</span>
      {valueContent}
    </div>
  );
}

// -- Main Page --

export default function TenantDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  function loadTenant() {
    fetch(`/api/super-admin/tenants/${tenantId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => setTenant(data))
      .catch(() => setError("Tenant not found"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTenant();
  }, [tenantId]);

  if (loading) return <Spinner />;

  if (error || !tenant) {
    return (
      <div className="px-8 py-8">
        <Link
          href="/super-admin/tenants"
          className="inline-flex items-center gap-1 text-sm text-secondary hover:text-heading transition-colors mb-5"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
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
      {/* Back link */}
      <Link
        href="/super-admin/tenants"
        className="inline-flex items-center gap-1 text-sm text-secondary hover:text-heading transition-colors mb-5"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to Tenants
      </Link>

      {/* Page header */}
      <div className="flex items-start gap-5 mb-6">
        {tenant.logoUrl ? (
          <img
            src={tenant.logoUrl}
            alt={tenant.name}
            className="w-14 h-14 rounded-2xl object-cover border border-border flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary font-bold text-lg flex items-center justify-center border border-border flex-shrink-0">
            {getInitials(tenant.name)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-heading truncate">
            {tenant.name}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="font-mono text-sm text-muted">{tenant.slug}</span>
            <span className="text-border-strong">·</span>
            <StatusBadge active={tenant.isActive} />
            <span className="text-border-strong">·</span>
            <span className="text-sm text-muted">
              Joined{" "}
              {new Date(tenant.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => {
                /* Phase 8: open edit slide-over */
              }}
              className="h-8 px-3 rounded-lg text-xs font-medium border border-border text-body hover:bg-surface-base transition-colors"
            >
              Edit Tenant
            </button>
            <button
              onClick={() => {
                /* Phase 11: suspend/reactivate */
              }}
              className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                tenant.isActive
                  ? "border border-error-border text-error hover:bg-error-bg"
                  : "bg-success text-inverse hover:opacity-90"
              }`}
            >
              {tenant.isActive ? "Suspend Tenant" : "Reactivate Tenant"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex flex-wrap gap-3 mb-6">
        <StatChip
          icon={<IconStudents />}
          value={tenant._count.students}
          label="Students"
        />
        <StatChip
          icon={<IconCourses />}
          value={tenant._count.courses}
          label="Courses"
        />
        <StatChip
          icon={<IconExams />}
          value={tenant._count.examAttempts}
          label="Exams"
        />
        <StatChip
          icon={<IconQuestions />}
          value={tenant._count.questions}
          label="Questions"
        />
      </div>

      {/* Tab navigation */}
      <div className="border-b border-border mb-0">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-primary font-semibold"
                  : "text-secondary hover:text-heading"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab tenant={tenant} />}
      {activeTab === "courses" && <CoursesTab tenantId={tenantId} />}
      {activeTab === "students" && <StudentsTab tenantId={tenantId} />}
    </div>
  );
}

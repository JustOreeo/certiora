"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type OverviewData = {
  tenants: { total: number; active: number; suspended: number };
  students: { total: number; thisMonth: number };
  organizations: { total: number };
  courses: { total: number; active: number };
  recentActivity: Array<{
    type: "TENANT_CREATED" | "INVITATION_SENT";
    description: string;
    timestamp: string;
  }>;
};

type TenantCard = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  isActive: boolean;
  organizationId: string | null;
  organization: { id: string; name: string } | null;
  _count: { users: number; courses: number };
  admin: { id: string; name: string | null; email: string } | null;
  lastActivity: string | null;
};

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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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

// -- Stat card icons with soft background tints --

function IconTenants() {
  return (
    <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#4B4EFC"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path
          d="M9 9h.01M9 12h.01M9 15h.01M15 9h.01M15 12h.01M15 15h.01"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function IconStudents() {
  return (
    <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2563EB"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    </div>
  );
}

function IconOrganizations() {
  return (
    <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] flex items-center justify-center">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#7C3AED"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
        <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
        <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
        <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
      </svg>
    </div>
  );
}

function IconCourses() {
  return (
    <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#16A34A"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <path d="M8 7h6M8 11h4" />
      </svg>
    </div>
  );
}

// -- Activity feed icons --

function IconTenantEvent() {
  return (
    <div className="w-7 h-7 rounded-full bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#4B4EFC"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 12h.01M15 12h.01" strokeWidth="3" />
      </svg>
    </div>
  );
}

function IconInvitationEvent() {
  return (
    <div className="w-7 h-7 rounded-full bg-[#FFFBEB] flex items-center justify-center flex-shrink-0">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#D97706"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    </div>
  );
}

// -- Stat Card --

function StatCard({
  icon,
  value,
  label,
  delta,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  delta?: string;
}) {
  return (
    <div className="bg-surface-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-1">
        {icon}
        <span className="text-2xl font-bold text-heading tabular-nums">
          {value.toLocaleString()}
        </span>
      </div>
      <p className="text-sm text-muted">{label}</p>
      {delta && <p className="text-xs text-success mt-1">{delta}</p>}
    </div>
  );
}

// -- Tenant Health Card --

function TenantHealthCard({ tenant }: { tenant: TenantCard }) {
  return (
    <div
      className={`bg-surface-card border border-border rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 ${
        !tenant.isActive ? "opacity-60" : ""
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {tenant.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center flex-shrink-0">
              {getInitials(tenant.name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-heading truncate">
              {tenant.name}
            </p>
            <p className="text-xs font-mono text-muted truncate">
              {tenant.slug}
            </p>
          </div>
          <StatusBadge active={tenant.isActive} />
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-border-subtle">
        <div className="flex items-center gap-1.5 text-xs text-secondary flex-wrap">
          <span>{tenant._count.users} students</span>
          <span className="text-border-strong">·</span>
          <span>{tenant.organization?.name ?? "Standalone"}</span>
          <span className="text-border-strong">·</span>
          <span>{tenant._count.courses} courses</span>
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-border-subtle flex items-center justify-between">
        <span className="text-xs text-muted">
          Last activity:{" "}
          {tenant.lastActivity ? timeAgo(tenant.lastActivity) : "Never"}
        </span>
        <Link
          href={`/super-admin/tenants/${tenant.id}`}
          className="text-xs font-medium text-primary hover:text-primary-hover transition-colors"
        >
          View →
        </Link>
      </div>
    </div>
  );
}

// -- Main Page --

export default function OverviewPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [tenants, setTenants] = useState<TenantCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/super-admin/overview").then((r) => r.json()),
      fetch("/api/super-admin/tenants").then((r) => r.json()),
    ])
      .then(([overviewData, tenantsData]) => {
        setOverview(overviewData);
        setTenants(tenantsData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="px-8 py-8 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-[22px] font-semibold text-heading">Overview</h1>
        <p className="text-sm text-secondary mt-0.5">
          Platform-wide stats and tenant health at a glance.
        </p>
      </div>

      {/* Stats row */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<IconTenants />}
            value={overview.tenants.active}
            label="Tenants"
            delta={
              overview.tenants.suspended > 0
                ? `${overview.tenants.suspended} suspended`
                : undefined
            }
          />
          <StatCard
            icon={<IconStudents />}
            value={overview.students.total}
            label="Students"
            delta={
              overview.students.thisMonth > 0
                ? `+${overview.students.thisMonth} this month`
                : undefined
            }
          />
          <StatCard
            icon={<IconOrganizations />}
            value={overview.organizations.total}
            label="Organizations"
          />
          <StatCard
            icon={<IconCourses />}
            value={overview.courses.active}
            label="Courses"
          />
        </div>
      )}

      {/* Tenant Health Grid */}
      <div>
        <h2 className="text-base font-semibold text-heading mb-4">
          Tenant Health
        </h2>
        {tenants.length === 0 ? (
          <div className="bg-surface-card border border-border rounded-2xl px-6 py-12 text-center">
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
              className="inline-flex h-9 items-center px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
            >
              Send first invitation →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((tenant) => (
              <TenantHealthCard key={tenant.id} tenant={tenant} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Feed */}
      {overview && overview.recentActivity.length > 0 && (
        <div className="bg-surface-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-sm font-semibold text-heading">
              Recent Activity
            </h2>
          </div>
          <div className="divide-y divide-border-subtle">
            {overview.recentActivity.map((event, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-base transition-colors"
              >
                {event.type === "TENANT_CREATED" ? (
                  <IconTenantEvent />
                ) : (
                  <IconInvitationEvent />
                )}
                <p className="flex-1 text-sm text-body">{event.description}</p>
                <span className="text-xs text-muted whitespace-nowrap">
                  {timeAgo(event.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

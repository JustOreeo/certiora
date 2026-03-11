"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const inputClass =
  "h-10 px-3 text-sm border border-border rounded-lg bg-surface-card text-body placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors w-full";

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

export default function NewOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/super-admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, logoUrl: logoUrl || null }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(
        typeof data.error === "string"
          ? data.error
          : JSON.stringify(data.error?.fieldErrors ?? data.error)
      );
      setSubmitting(false);
      return;
    }

    router.push("/super-admin/organizations");
  }

  return (
    <div className="px-8 py-8 max-w-lg">
      <Link
        href="/super-admin/organizations"
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
        Back to Organizations
      </Link>

      <div className="mb-7">
        <h1 className="text-[22px] font-semibold text-heading">
          New Organization
        </h1>
        <p className="text-sm text-secondary mt-0.5">
          Create a brand that groups multiple branch locations together.
        </p>
      </div>

      <div className="bg-surface-card border border-border rounded-xl shadow-sm">
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="px-3.5 py-2.5 rounded-lg text-sm bg-error-bg border border-error-border text-error">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-secondary">
              Organization name *
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="e.g., Oree Review"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-secondary">
              Logo URL
            </label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className={inputClass}
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-muted">
              Optional. Direct link to the organization logo image.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/super-admin/organizations"
              className="h-9 px-4 inline-flex items-center rounded-lg text-sm font-medium border border-border text-body hover:bg-surface-base transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="h-9 px-5 inline-flex items-center gap-2 rounded-lg text-sm font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {submitting && <SmallSpinner />}
              Create Organization
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

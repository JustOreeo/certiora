"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export default function AdminBrandingPage() {
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const branding = useTenantBranding();
  const tenantSlug = params?.tenantSlug ?? "";

  const [logoUrl, setLogoUrl] = useState(branding.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(branding.primaryColor ?? "#4B4EFC");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const urlToSave = logoUrl.trim() || null;
    const colorToSave = HEX_REGEX.test(primaryColor.trim()) ? primaryColor.trim() : null;
    if (colorToSave === null && primaryColor.trim() !== "") {
      setError("Primary color must be a valid hex code (e.g. #4B4EFC).");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/${tenantSlug}/admin/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: urlToSave,
          primaryColor: colorToSave ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save branding.");
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-8 py-8">
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold text-heading">Branding</h1>
        <p className="text-sm text-secondary mt-1">
          Customize your workspace logo and primary color for white-labeling. These appear on student-facing pages and in the admin sidebar.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
        {error && (
          <div className="rounded-lg bg-error-bg border border-error-border text-error px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-success-bg border border-success-border text-success px-4 py-3 text-sm">
            Branding saved. Changes are reflected across the app.
          </div>
        )}

        <div>
          <label htmlFor="logoUrl" className="block text-sm font-medium text-heading mb-1.5">
            Logo URL
          </label>
          <input
            id="logoUrl"
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-body text-sm focus:outline-none focus:ring-2 focus:ring-border-focus focus:border-transparent"
          />
          <p className="mt-1 text-xs text-secondary">
            Full URL to your logo image. Shown in the header and sidebar. Leave empty to use the default Certiora mark.
          </p>
        </div>

        <div>
          <label htmlFor="primaryColor" className="block text-sm font-medium text-heading mb-1.5">
            Primary color
          </label>
          <div className="flex items-center gap-3">
            <input
              id="primaryColor"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-14 rounded border border-border cursor-pointer bg-surface-input p-1"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#4B4EFC"
              pattern="^#[0-9A-Fa-f]{6}$"
              className="flex-1 rounded-lg border border-border bg-surface-input px-3 py-2 font-mono text-body text-sm focus:outline-none focus:ring-2 focus:ring-border-focus focus:border-transparent"
            />
          </div>
          <p className="mt-1 text-xs text-secondary">
            Hex color (e.g. #4B4EFC) applied to links, buttons, and accents across the tenant UI.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-text-inverse hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save branding"}
          </button>
        </div>
      </form>
    </div>
  );
}

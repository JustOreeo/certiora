"use client";

import { useState } from "react";
import Link from "next/link";

function CertioraLogo() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#0D0D12" />
      <path
        d="M20 8L11 12V19C11 23.4 15 27.5 20 29C25 27.5 29 23.4 29 19V12L20 8Z"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M16 19.5L18.5 22L24 17"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const inputClass =
  "w-full h-12 px-4 text-sm rounded-lg border transition-colors focus:outline-none";
const inputStyle = { borderColor: "#E4E4E7", color: "#0D0D12" };
const inputFocus = (e: React.FocusEvent<HTMLInputElement>) =>
  (e.currentTarget.style.borderColor = "#0D0D12");
const inputBlur = (e: React.FocusEvent<HTMLInputElement>) =>
  (e.currentTarget.style.borderColor = "#E4E4E7");

export default function SignupPage() {
  const [formData, setFormData] = useState({
    tenantName: "",
    tenantSlug: "",
    adminName: "",
    adminEmail: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ password: string; message?: string } | null>(null);

  const handleSlugFromName = () => {
    const slug = formData.tenantName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);
    setFormData((prev) => ({ ...prev, tenantSlug: slug }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantName: formData.tenantName,
        tenantSlug: formData.tenantSlug,
        adminName: formData.adminName,
        adminEmail: formData.adminEmail,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Signup failed");
      setLoading(false);
      return;
    }

    setSuccess({ password: data.password, message: data.message });
    setLoading(false);
  };

  // ── Success state ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="mb-6">
          <CertioraLogo />
        </div>
        <div className="w-full max-w-[380px] border border-[#E4E4E7] rounded-[20px] p-8">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
            style={{ background: "#F0FDF4" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 12L9.5 16.5L19 7" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight mb-1" style={{ color: "#0D0D12" }}>
            Review center created
          </h1>
          <p className="text-sm mb-5" style={{ color: "#71717A" }}>
            Save your temporary password — it will not be shown again.
          </p>

          {/* Password display */}
          <div
            className="rounded-xl p-4 mb-5"
            style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
          >
            <p className="text-xs font-semibold mb-2" style={{ color: "#92400E" }}>
              Temporary password
            </p>
            <code
              className="block text-base font-mono break-all"
              style={{ color: "#78350F" }}
            >
              {success.password}
            </code>
          </div>

          <Link
            href="/login"
            className="flex items-center justify-center w-full h-12 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#4B4EFC" }}
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  // ── Signup form ───────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-6">
        <CertioraLogo />
      </div>

      {/* Card */}
      <div className="w-full max-w-[380px] border border-[#E4E4E7] rounded-[20px] p-8">
        <div className="text-center mb-6">
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "#0D0D12" }}>
            Create your review center
          </h1>
          <p className="text-sm mt-1" style={{ color: "#71717A" }}>
            You'll receive a password to log in right away.
          </p>
        </div>

        {error && (
          <div
            className="mb-4 px-3.5 py-3 rounded-lg text-sm"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            required
            placeholder="Review center name"
            value={formData.tenantName}
            onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
            onBlur={handleSlugFromName}
            className={inputClass}
            style={inputStyle}
            onFocus={inputFocus}
          />

          <div>
            <input
              type="text"
              required
              placeholder="URL slug (e.g. ace-review)"
              value={formData.tenantSlug}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  tenantSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                })
              }
              className={inputClass}
              style={inputStyle}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
            <p className="text-xs mt-1.5 px-1" style={{ color: "#A1A1AA" }}>
              yourapp.com/{formData.tenantSlug || "slug"}/admin
            </p>
          </div>

          <input
            type="text"
            required
            placeholder="Your full name"
            value={formData.adminName}
            onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
            className={inputClass}
            style={inputStyle}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          <input
            type="email"
            required
            placeholder="Email address"
            value={formData.adminEmail}
            onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
            className={inputClass}
            style={inputStyle}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 mt-0.5"
            style={{
              background: loading ? "#E4E4E7" : "#4B4EFC",
              color: loading ? "#71717A" : "#FFFFFF",
            }}
          >
            {loading ? (
              <>
                <Spinner />
                Creating account…
              </>
            ) : (
              "Create account"
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-5 text-xs text-center" style={{ color: "#A1A1AA" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "#4B4EFC" }}>
          Sign in
        </Link>
      </p>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type InvitationInfo = {
  email: string;
  role: string;
  tenantName?: string;
  tenantSlug?: string;
};

// ── Shared auth primitives ───────────────────────────────────────────────────

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

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" stroke="#A1A1AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="#A1A1AA" strokeWidth="1.5" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="#A1A1AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="1" y1="1" x2="23" y2="23" stroke="#A1A1AA" strokeWidth="1.5" strokeLinecap="round" />
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError("No invitation token provided.");
      return;
    }
    fetch(`/api/auth/invitation?token=${token}`)
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(d.error));
        return res.json();
      })
      .then(setInvitation)
      .catch((msg) => setLoadError(msg || "Invalid or expired invitation."));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/accept-invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to complete signup.");
      setLoading(false);
      return;
    }
    setSuccess(true);
  };

  // ── Invalid token ─────────────────────────────────────────────────────────
  if (!token || loadError) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="mb-6">
          <CertioraLogo />
        </div>
        <div className="w-full max-w-[380px] border border-[#E4E4E7] rounded-[20px] p-8 text-center">
          <p className="text-lg font-bold mb-2" style={{ color: "#0D0D12" }}>
            Invalid invitation
          </p>
          <p className="text-sm mb-6" style={{ color: "#71717A" }}>
            {loadError || "This invitation link is not valid."}
          </p>
          <a
            href="/login"
            className="inline-block text-sm font-semibold"
            style={{ color: "#4B4EFC" }}
          >
            Go to login
          </a>
        </div>
      </main>
    );
  }

  // ── Loading invitation ────────────────────────────────────────────────────
  if (!invitation) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="mb-6">
          <CertioraLogo />
        </div>
        <p className="text-sm" style={{ color: "#A1A1AA" }}>
          Loading your invitation…
        </p>
      </main>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (success) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="mb-6">
          <CertioraLogo />
        </div>
        <div className="w-full max-w-[380px] border border-[#E4E4E7] rounded-[20px] p-8 text-center">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "#F0FDF4" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 12L9.5 16.5L19 7" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight mb-2" style={{ color: "#0D0D12" }}>
            Account created
          </h1>
          <p className="text-sm mb-6" style={{ color: "#71717A" }}>
            You can now sign in with your email and password.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full h-12 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#4B4EFC" }}
          >
            Go to login
          </button>
        </div>
      </main>
    );
  }

  // ── Signup form ───────────────────────────────────────────────────────────
  const roleLabel =
    invitation.role === "ADMIN" ? "administrator" : "student";

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-6">
        <CertioraLogo />
      </div>

      {/* Card */}
      <div className="w-full max-w-[380px] border border-[#E4E4E7] rounded-[20px] p-8">
        <div className="text-center mb-6">
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "#0D0D12" }}>
            Create your account
          </h1>
          <p className="text-sm mt-1" style={{ color: "#71717A" }}>
            {invitation.tenantName
              ? `You're joining ${invitation.tenantName} as ${roleLabel === "administrator" ? "an" : "a"} ${roleLabel}`
              : `You've been invited as ${roleLabel === "administrator" ? "an" : "a"} ${roleLabel}`}
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
          {/* Email (read-only) */}
          <input
            type="email"
            value={invitation.email}
            disabled
            className="w-full h-12 px-4 text-sm rounded-lg border"
            style={{ borderColor: "#E4E4E7", color: "#A1A1AA", background: "#FAFAFA" }}
          />

          {/* Full name */}
          <input
            type="text"
            required
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            style={inputStyle}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />

          {/* Password */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              placeholder="Password (min. 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-11`}
              style={inputStyle}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center"
            >
              <EyeIcon visible={showPassword} />
            </button>
          </div>

          {/* Confirm password */}
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              required
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`${inputClass} pr-11`}
              style={inputStyle}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center"
            >
              <EyeIcon visible={showConfirm} />
            </button>
          </div>

          {/* Submit */}
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
        <a href="/login" style={{ color: "#4B4EFC" }}>
          Sign in
        </a>
      </p>
    </main>
  );
}

"use client";

import { useState, useEffect } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

// ── Shared auth primitives ───────────────────────────────────────────────────

function CertioraLogo() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#0D0D12" />
      {/* Shield outline */}
      <path
        d="M20 8L11 12V19C11 23.4 15 27.5 20 29C25 27.5 29 23.4 29 19V12L20 8Z"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Check mark */}
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Show expired-credentials message when redirected from middleware
  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "CredentialsExpired") {
      setError("Your access has expired. Please contact your review center for new credentials.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(
        result.error === "CredentialsExpired"
          ? "Your access has expired. Please contact your review center for new credentials."
          : "Invalid email or password. Please try again."
      );
      setLoading(false);
      return;
    }

    if (result?.ok) {
      const session = await getSession();
      const callbackUrl = searchParams.get("callbackUrl");

      if (callbackUrl) {
        router.push(callbackUrl);
      } else if (session?.role === "SUPER_ADMIN") {
        router.push("/super-admin");
      } else if (session?.role === "ADMIN" || session?.role === "INSTRUCTOR") {
        router.push(`/${session.tenantSlug}/admin`);
      } else if (session?.role === "STUDENT") {
        router.push(`/${session.tenantSlug}/exams`);
      } else {
        router.push("/");
      }

      router.refresh();
    }
  };

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      {/* Logo mark */}
      <div className="mb-6">
        <CertioraLogo />
      </div>

      {/* Card */}
      <div className="w-full max-w-[380px] border border-[#E4E4E7] rounded-[20px] p-8">
        <div className="text-center mb-6">
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "#0D0D12" }}>
            Welcome back
          </h1>
          <p className="text-sm mt-1" style={{ color: "#71717A" }}>
            Sign in to your account
          </p>
        </div>

        {error && (
          <div className="mb-4 px-3.5 py-3 rounded-lg text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Email */}
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-12 px-4 text-sm rounded-lg border transition-colors focus:outline-none"
            style={{
              borderColor: "#E4E4E7",
              color: "#0D0D12",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#0D0D12")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E4E7")}
          />

          {/* Password */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 pr-11 text-sm rounded-lg border transition-colors focus:outline-none"
              style={{
                borderColor: "#E4E4E7",
                color: "#0D0D12",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#0D0D12")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E4E4E7")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center"
            >
              <EyeIcon visible={showPassword} />
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
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-5 text-xs text-center" style={{ color: "#A1A1AA" }}>
        Access to Certiora is by invitation only.
      </p>
    </main>
  );
}

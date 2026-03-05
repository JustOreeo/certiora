"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [formData, setFormData] = useState({
    tenantName: "",
    tenantSlug: "",
    adminName: "",
    adminEmail: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ password: string } | null>(null);

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

    setSuccess({ password: data.password });
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-2">Review Center Created</h1>
          <p className="text-gray-600 mb-4">{success.message}</p>
          <div className="bg-amber-50 border-2 border-amber-300 rounded p-4 mb-4">
            <p className="text-sm font-semibold text-amber-800 mb-2">Your temporary password (save it now):</p>
            <code className="block bg-white p-3 rounded border border-amber-200 text-lg font-mono break-all">
              {success.password}
            </code>
          </div>
          <Link
            href="/login"
            className="block w-full text-center px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-2">Create Your Review Center</h1>
        <p className="text-gray-500 text-sm mb-6">
          Sign up with your review center details. You will receive a one-time password to log in.
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Review center name</label>
            <input
              type="text"
              required
              value={formData.tenantName}
              onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
              onBlur={handleSlugFromName}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Ace Review Center"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">URL slug</label>
            <input
              type="text"
              required
              value={formData.tenantSlug}
              onChange={(e) =>
                setFormData({ ...formData, tenantSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
              }
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. acereview"
            />
            <p className="text-xs text-gray-500 mt-1">Used in URLs: yourapp.com/{formData.tenantSlug || "slug"}/admin</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Your name</label>
            <input
              type="text"
              required
              value={formData.adminName}
              onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Admin name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={formData.adminEmail}
              onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

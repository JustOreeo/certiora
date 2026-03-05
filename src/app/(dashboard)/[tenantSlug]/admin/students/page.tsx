"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";

type Student = {
  id: string;
  email: string;
  name: string;
  credentialsExpiresAt: string;
  createdAt: string;
};

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
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    } else if (status === "authenticated") {
      loadStudents();
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
        alert("Upload failed: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed");
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
      body: JSON.stringify({ email: inviteEmail }),
    });

    const data = await res.json();

    if (!res.ok) {
      setInviteError(typeof data.error === "string" ? data.error : "Failed to create invitation");
      setInviting(false);
      return;
    }

    setInviteLink(`${window.location.origin}${data.invitationUrl}`);
    setInviteEmail("");
    setInviting(false);
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
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Students</h1>
        <div className="flex gap-2">
          <label className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
            {uploading ? "Uploading..." : "Upload CSV"}
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Invite Student */}
      <div className="bg-white border rounded p-4 mb-6">
        <h3 className="font-semibold mb-3">Invite a Student</h3>
        {inviteError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-3 text-sm">
            {inviteError}
          </div>
        )}
        {inviteLink && (
          <div className="bg-green-50 border border-green-200 rounded p-3 mb-3">
            <p className="text-sm font-medium text-green-800 mb-2">Invitation created! Share this link:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border rounded px-3 py-2 text-xs break-all">{inviteLink}</code>
              <button
                onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 whitespace-nowrap"
              >
                Copy
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
            className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            type="submit"
            disabled={inviting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm whitespace-nowrap"
          >
            {inviting ? "Sending..." : "Send Invitation"}
          </button>
        </form>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
        <h3 className="font-semibold mb-2">CSV Format</h3>
        <p className="text-sm mb-2">Upload a CSV with these columns:</p>
        <pre className="text-xs bg-white p-2 rounded">
          studentId,name,email,credentialsExpiresAt{"\n"}
          2024001,John Doe,john@example.com,2024-12-31{"\n"}
          2024002,Jane Smith,,2024-12-31
        </pre>
        <p className="text-xs mt-2 text-gray-600">
          If email is empty, we'll use studentId@student.local
        </p>
      </div>

      {credentials.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Generated Credentials ({credentials.length})</h3>
            <button
              onClick={downloadCredentials}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Download CSV
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Student ID</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Username</th>
                  <th className="p-2 text-left">Password</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((c, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{c.studentId}</td>
                    <td className="p-2">{c.name}</td>
                    <td className="p-2">{c.username}</td>
                    <td className="p-2">
                      <code className="bg-gray-100 px-2 py-1 rounded">{c.password}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white border rounded">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-semibold">All Students ({students.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Username</th>
                <th className="p-3 text-left">Expires At</th>
                <th className="p-3 text-left">Created At</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{s.name}</td>
                  <td className="p-3">{s.email}</td>
                  <td className="p-3">
                    {s.credentialsExpiresAt
                      ? new Date(s.credentialsExpiresAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="p-3">{new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

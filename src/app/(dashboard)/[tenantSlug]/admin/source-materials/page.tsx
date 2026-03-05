"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toUserMessage } from "@/lib/errors";

type SourceMaterial = {
  id: string;
  fileName: string;
  pageCount: number | null;
  status: "UPLOADED" | "PROCESSING" | "CHUNKED" | "FAILED";
  ingestionError: string | null;
  createdAt: string;
};

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconFilePdf() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="9" y2="17" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="15" y1="14" x2="15" y2="17" />
    </svg>
  );
}

function StatusBadge({ status }: { status: SourceMaterial["status"] }) {
  const map: Record<SourceMaterial["status"], { label: string; className: string }> = {
    UPLOADED:   { label: "Uploaded",   className: "bg-surface-base text-secondary border-border" },
    PROCESSING: { label: "Processing", className: "bg-warning-bg text-warning border-warning-border" },
    CHUNKED:    { label: "Ready",      className: "bg-success-bg text-success border-success-border" },
    FAILED:     { label: "Failed",     className: "bg-error-bg text-error border-error-border" },
  };
  const cfg = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.className}`}>
      {status === "PROCESSING" && <Spinner size={10} />}
      {cfg.label}
    </span>
  );
}

export default function SourceMaterialsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const [materials, setMaterials] = useState<SourceMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadState, setUploadState] = useState<
    "idle" | "requesting" | "uploading" | "confirming" | "done" | "error"
  >("idle");
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadMaterials = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/source-materials");
      if (!res.ok) return;
      const data = await res.json();
      setMaterials(data.items || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") loadMaterials();
  }, [status, loadMaterials]);

  // Poll while any material is PROCESSING
  useEffect(() => {
    const hasProcessing = materials.some((m) => m.status === "PROCESSING" || m.status === "UPLOADED");
    if (hasProcessing && !pollingRef.current) {
      pollingRef.current = setInterval(() => loadMaterials(), 4000);
    } else if (!hasProcessing && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [materials, loadMaterials]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setUploadState("requesting");
    setUploadProgress(0);

    try {
      // Step 1: request presigned URL
      const urlRes = await fetch("/api/admin/source-materials/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/pdf" }),
      });

      if (!urlRes.ok) {
        const err = await urlRes.json();
        throw new Error(toUserMessage(err, "Failed to get upload URL"));
      }

      const { uploadUrl, sourceMaterialId } = await urlRes.json();

      // Step 2: upload directly to S3
      setUploadState("uploading");
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Upload to storage failed. Please try again.");
      setUploadProgress(100);

      // Step 3: confirm and enqueue ingestion
      setUploadState("confirming");
      const confirmRes = await fetch("/api/admin/source-materials/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceMaterialId }),
      });

      if (!confirmRes.ok) {
        const err = await confirmRes.json();
        throw new Error(toUserMessage(err, "Failed to start processing"));
      }

      setUploadState("done");
      await loadMaterials();
      setTimeout(() => setUploadState("idle"), 2000);
    } catch (err) {
      setUploadError(toUserMessage(err, "Upload failed. Please try again."));
      setUploadState("error");
    } finally {
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/source-materials/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        alert(toUserMessage(err, "Delete failed. Please try again."));
        return;
      }
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const uploadButtonLabel = () => {
    switch (uploadState) {
      case "requesting": return "Requesting upload…";
      case "uploading": return `Uploading… ${uploadProgress}%`;
      case "confirming": return "Starting ingestion…";
      case "done": return "Upload complete";
      default: return "Upload PDF";
    }
  };

  const isUploading = ["requesting", "uploading", "confirming"].includes(uploadState);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-semibold text-heading">Source Materials</h1>
          <p className="text-sm text-secondary mt-0.5">
            {materials.length} {materials.length === 1 ? "document" : "documents"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {uploadState === "error" && (
            <p className="text-xs text-error max-w-xs truncate">{uploadError}</p>
          )}
          <button
            onClick={() => !isUploading && fileInputRef.current?.click()}
            disabled={isUploading}
            className={`flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors ${
              isUploading || uploadState === "done"
                ? "bg-surface-base border border-border text-secondary cursor-not-allowed"
                : "bg-primary text-inverse hover:bg-primary-hover"
            }`}
          >
            {isUploading ? <Spinner /> : <IconUpload />}
            {uploadButtonLabel()}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* Materials list */}
      {materials.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl px-5 py-16 text-center shadow-sm">
          <div className="flex justify-center mb-3 text-muted">
            <IconFilePdf />
          </div>
          <p className="text-sm font-medium text-body mb-1">No source materials yet</p>
          <p className="text-xs text-secondary mb-4">
            Upload a PDF to make reference content available while writing questions.
          </p>
          <button
            type="button"
            onClick={() => !isUploading && fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors disabled:opacity-60"
          >
            {isUploading ? <Spinner size={14} /> : <IconUpload />}
            Upload PDF
          </button>
        </div>
      ) : (
        <div className="bg-surface-card border border-border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-5 py-3 text-left text-xs font-medium text-secondary">Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-secondary">Pages</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-secondary">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-secondary">Uploaded</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {materials.map((m) => (
                <tr key={m.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-muted shrink-0"><IconFilePdf /></span>
                      <span className="font-medium text-body truncate max-w-xs">{m.fileName}</span>
                    </div>
                    {m.status === "FAILED" && (
                      <p className="text-xs text-error mt-1 ml-6 max-w-xs">
                        Processing failed. You can delete and re-upload this file.
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-secondary">
                    {m.pageCount != null ? m.pageCount : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-5 py-3.5 text-secondary text-xs whitespace-nowrap">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      {m.status === "CHUNKED" && (
                        <Link
                          href={`/${params.tenantSlug}/admin/source-materials/${m.id}`}
                          className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium bg-surface-base border border-border text-secondary hover:border-border-strong hover:text-body transition-colors"
                        >
                          <IconEye />
                          View
                        </Link>
                      )}
                      {deleteConfirm === m.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDelete(m.id)}
                            disabled={deleting}
                            className="h-7 px-3 rounded-lg text-xs font-medium bg-error text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            {deleting ? <Spinner size={10} /> : "Confirm"}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="h-7 px-3 rounded-lg text-xs font-medium bg-surface-base border border-border text-secondary hover:border-border-strong transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(m.id)}
                          className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium bg-surface-base border border-border text-secondary hover:border-error hover:text-error hover:border-error-border transition-colors"
                        >
                          <IconTrash />
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

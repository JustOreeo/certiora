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
  status: "UPLOADED" | "PROCESSING" | "CHUNKED" | "PARSED" | "COMPLETED" | "FAILED";
  ingestionError: string | null;
  questionsGenerated: number | null;
  flashcardsGenerated: number | null;
  questionsApproved: number | null;
  flashcardsApproved: number | null;
  generatedDeckId: string | null;
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

function IconFilePdf() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="9" y2="17" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="15" y1="14" x2="15" y2="17" />
    </svg>
  );
}

function IconClipboardCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 14l2 2 4-4" />
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

type StatusConfig = { label: string; className: string; showSpinner?: boolean };

function StatusBadge({ status }: { status: SourceMaterial["status"] }) {
  const map: Record<SourceMaterial["status"], StatusConfig> = {
    UPLOADED: { label: "Uploaded", className: "bg-surface-base text-secondary border-border" },
    PROCESSING: { label: "Processing", className: "bg-warning-bg text-warning border-warning-border", showSpinner: true },
    CHUNKED: { label: "Ready", className: "bg-success-bg text-success border-success-border" },
    PARSED: { label: "Ready for review", className: "bg-primary/10 text-primary border-primary/30" },
    COMPLETED: { label: "Completed", className: "bg-success-bg text-success border-success-border" },
    FAILED: { label: "Failed", className: "bg-error-bg text-error border-error-border" },
  };
  const cfg = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${cfg.className}`}>
      {cfg.showSpinner && <Spinner size={10} />}
      {cfg.label}
    </span>
  );
}

function IndeterminateProgress() {
  return (
    <div className="w-full h-1.5 bg-surface-base rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary/40 via-primary to-primary/40 animate-indeterminate"
        style={{
          width: "40%",
          animation: "indeterminate 1.5s ease-in-out infinite",
        }}
      />
      <style jsx>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}

function ElapsedTime({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const start = new Date(since).getTime();

    const update = () => {
      const diffMs = Date.now() - start;
      const secs = Math.floor(diffMs / 1000);
      if (secs < 60) {
        setElapsed(`${secs}s`);
      } else {
        const mins = Math.floor(secs / 60);
        const remainSecs = secs % 60;
        setElapsed(`${mins}m ${remainSecs}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [since]);

  return <span>{elapsed}</span>;
}

function ContentStats({ material }: { material: SourceMaterial }) {
  const qGen = material.questionsGenerated ?? 0;
  const fcGen = material.flashcardsGenerated ?? 0;
  const qApp = material.questionsApproved ?? 0;
  const fcApp = material.flashcardsApproved ?? 0;

  if (qGen === 0 && fcGen === 0) return null;

  return (
    <div className="flex items-center gap-3 text-xs text-secondary mt-1.5">
      <span>
        {qGen} {qGen === 1 ? "question" : "questions"}
        {qApp > 0 && <span className="text-success"> ({qApp} approved)</span>}
      </span>
      <span className="text-border">|</span>
      <span>
        {fcGen} {fcGen === 1 ? "flashcard" : "flashcards"}
        {fcApp > 0 && <span className="text-success"> ({fcApp} approved)</span>}
      </span>
    </div>
  );
}

export default function ContentPipelinePage() {
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
  const [uploadFileName, setUploadFileName] = useState("");
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

  // Poll while any material is PROCESSING or UPLOADED
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
    setUploadFileName(file.name);

    try {
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

      setUploadState("uploading");
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Upload to storage failed. Please try again.");
      setUploadProgress(100);

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
      case "requesting": return "Requesting upload...";
      case "uploading": return `Uploading... ${uploadProgress}%`;
      case "confirming": return "Starting pipeline...";
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
          <h1 className="text-[22px] font-semibold text-heading">Content Pipeline</h1>
          <p className="text-sm text-secondary mt-0.5">
            Upload PDFs to automatically generate exam questions and flashcard decks.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Upload progress indicator */}
      {uploadState !== "idle" && uploadState !== "error" && (
        <div className="bg-surface-card border border-border rounded-xl shadow-sm px-5 py-5 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-muted shrink-0"><IconFilePdf /></span>
            <div className="min-w-0">
              <p className="font-medium text-body text-sm truncate">{uploadFileName}</p>
              <p className="text-xs text-secondary mt-0.5">
                {uploadState === "done" ? "Upload complete — document queued for processing" : "Uploading document..."}
              </p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-0">
            {[
              { key: "requesting", label: "Preparing", activeOn: ["requesting"] },
              { key: "uploading", label: "Uploading to storage", activeOn: ["uploading"] },
              { key: "confirming", label: "Starting pipeline", activeOn: ["confirming"] },
              { key: "done", label: "Complete", activeOn: ["done"] },
            ].map((step, idx) => {
              const isActive = step.activeOn.includes(uploadState);
              const stepOrder = ["requesting", "uploading", "confirming", "done"];
              const currentIdx = stepOrder.indexOf(uploadState);
              const stepIdx = stepOrder.indexOf(step.key);
              const isCompleted = stepIdx < currentIdx;

              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                      isCompleted
                        ? "bg-success text-white"
                        : isActive
                        ? "bg-primary text-inverse"
                        : "bg-surface-base border border-border text-muted"
                    }`}>
                      {isCompleted ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : isActive ? (
                        <Spinner size={12} />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span className={`text-[10px] mt-1.5 text-center ${
                      isActive ? "text-primary font-medium" : isCompleted ? "text-success" : "text-muted"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < 3 && (
                    <div className={`h-0.5 w-full -mt-4 ${
                      isCompleted ? "bg-success" : "bg-border"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload error */}
      {uploadState === "error" && (
        <div className="bg-error-bg border border-error-border rounded-xl px-5 py-4 mb-5">
          <div className="flex items-start gap-3">
            <span className="text-error shrink-0 mt-0.5"><IconFilePdf /></span>
            <div>
              <p className="text-sm font-medium text-error">{uploadFileName} — Upload failed</p>
              <p className="text-xs text-error/80 mt-0.5">{uploadError}</p>
              <button
                onClick={() => { setUploadState("idle"); setUploadError(""); }}
                className="text-xs font-medium text-error underline mt-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Materials list */}
      {/* Empty state — only when no materials AND not uploading */}
      {materials.length === 0 && uploadState === "idle" && (
        <div className="bg-surface-card border border-border rounded-xl px-5 py-16 text-center shadow-sm">
          <div className="flex justify-center mb-3 text-muted">
            <IconFilePdf />
          </div>
          <p className="text-sm font-medium text-body mb-1">No documents uploaded yet</p>
          <p className="text-xs text-secondary mb-4">
            Upload a PDF to generate exam questions and flashcard decks automatically.
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
      )}

      {/* Materials list */}
      {materials.length > 0 && (
        <div className="space-y-3">
          {materials.map((m) => (
            <div
              key={m.id}
              className="bg-surface-card border border-border rounded-xl shadow-sm px-5 py-4 hover:border-border-strong transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: file info */}
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-muted shrink-0 mt-0.5">
                    <IconFilePdf />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-medium text-body truncate max-w-xs">
                        {m.fileName}
                      </span>
                      <StatusBadge status={m.status} />
                    </div>

                    {m.status === "PROCESSING" && (
                      <div className="mt-2 space-y-1.5">
                        <IndeterminateProgress />
                        <p className="text-xs text-secondary">
                          Pipeline is analyzing your document... <ElapsedTime since={m.createdAt} />
                        </p>
                      </div>
                    )}

                    {m.status === "FAILED" && (
                      <p className="text-xs text-error mt-1.5">
                        {m.ingestionError || "Processing failed. You can delete and re-upload this file."}
                      </p>
                    )}

                    <ContentStats material={m} />

                    <p className="text-xs text-muted mt-1">
                      {new Date(m.createdAt).toLocaleDateString()}
                      {m.pageCount != null && ` \u00B7 ${m.pageCount} pages`}
                    </p>
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {m.status === "PARSED" && (
                    <Link
                      href={`/${params.tenantSlug}/admin/source-materials/${m.id}/review`}
                      className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors"
                    >
                      <IconClipboardCheck />
                      Review Content
                    </Link>
                  )}

                  {m.status === "COMPLETED" && (
                    <Link
                      href={`/${params.tenantSlug}/admin/source-materials/${m.id}/review`}
                      className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-medium bg-surface-base border border-border text-secondary hover:border-border-strong hover:text-body transition-colors"
                    >
                      <IconEye />
                      View
                    </Link>
                  )}

                  {/* Legacy: view chunks for old CHUNKED materials */}
                  {m.status === "CHUNKED" && (
                    <Link
                      href={`/${params.tenantSlug}/admin/source-materials/${m.id}`}
                      className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-medium bg-surface-base border border-border text-secondary hover:border-border-strong hover:text-body transition-colors"
                    >
                      <IconEye />
                      View Chunks
                    </Link>
                  )}

                  {deleteConfirm === m.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={deleting}
                        className="h-8 px-3 rounded-lg text-xs font-medium bg-error text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {deleting ? <Spinner size={10} /> : "Confirm"}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="h-8 px-3 rounded-lg text-xs font-medium bg-surface-base border border-border text-secondary hover:border-border-strong transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(m.id)}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-surface-base border border-border text-secondary hover:border-error hover:text-error transition-colors"
                    >
                      <IconTrash />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

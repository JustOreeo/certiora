"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type SourceMaterial = {
  id: string;
  fileName: string;
  pageCount: number | null;
  status: string;
  createdAt: string;
};

type Chunk = {
  id: string;
  pageIndex: number;
  chunkIndex: number;
  content: string;
};

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export default function SourceMaterialViewerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string; id: string }>();
  const [material, setMaterial] = useState<SourceMaterial | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const load = async () => {
      try {
        const [matRes, chunksRes] = await Promise.all([
          fetch(`/api/admin/source-materials/${params.id}`),
          fetch(`/api/admin/source-materials/${params.id}/chunks`),
        ]);

        if (!matRes.ok) {
          setError("Source material not found");
          return;
        }

        const matData = await matRes.json();
        const chunksData = chunksRes.ok ? await chunksRes.json() : { chunks: [] };

        setMaterial(matData);
        setChunks(chunksData.chunks || []);
        setCurrentPage(0);
      } catch {
        setError("Failed to load source material");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [status, params.id]);

  // Group chunks by pageIndex
  const pageMap = chunks.reduce<Record<number, Chunk[]>>((acc, chunk) => {
    if (!acc[chunk.pageIndex]) acc[chunk.pageIndex] = [];
    acc[chunk.pageIndex].push(chunk);
    return acc;
  }, {});

  const sortedPageIndexes = Object.keys(pageMap)
    .map(Number)
    .sort((a, b) => a - b);

  const totalPages = sortedPageIndexes.length;
  const currentPageIndex = sortedPageIndexes[currentPage];
  const currentChunks = currentPageIndex !== undefined ? (pageMap[currentPageIndex] ?? []) : [];
  const currentContent = currentChunks
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .map((c) => c.content)
    .join("\n\n");

  const goTo = (page: number) => {
    if (page >= 0 && page < totalPages) setCurrentPage(page);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (error || !material) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-error">{error || "Not found"}</p>
        <Link
          href={`/${params.tenantSlug}/admin/source-materials`}
          className="inline-flex items-center gap-1.5 mt-4 text-sm text-secondary hover:text-body transition-colors"
        >
          <IconArrowLeft />
          Back to source materials
        </Link>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 flex flex-col h-full">
      {/* Back link + header */}
      <div className="mb-6">
        <Link
          href={`/${params.tenantSlug}/admin/source-materials`}
          className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-body transition-colors mb-4"
        >
          <IconArrowLeft />
          Source Materials
        </Link>
        <h1 className="text-[22px] font-semibold text-heading truncate">{material.fileName}</h1>
        <p className="text-sm text-secondary mt-0.5">
          {totalPages} {totalPages === 1 ? "page" : "pages"} extracted
        </p>
      </div>

      {totalPages === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl px-5 py-12 text-center text-sm text-secondary shadow-sm">
          No text content was extracted from this document.
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          {/* Page navigation bar */}
          <div className="flex items-center justify-between bg-surface-card border border-border rounded-xl px-5 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={() => goTo(currentPage - 1)}
                disabled={currentPage === 0}
                className="flex items-center justify-center w-7 h-7 rounded-lg border border-border text-secondary hover:border-border-strong hover:text-body transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <IconChevronLeft />
              </button>

              <span className="text-sm text-body">
                Page{" "}
                <span className="font-semibold">{currentPage + 1}</span>
                {" "}of{" "}
                <span className="font-semibold">{totalPages}</span>
              </span>

              <button
                onClick={() => goTo(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                className="flex items-center justify-center w-7 h-7 rounded-lg border border-border text-secondary hover:border-border-strong hover:text-body transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <IconChevronRight />
              </button>
            </div>

            {/* Page jump select */}
            <select
              value={currentPage}
              onChange={(e) => goTo(Number(e.target.value))}
              className="h-8 px-2 text-xs border border-border rounded-lg bg-surface-card text-body focus:outline-none focus:border-border-focus transition-colors"
            >
              {sortedPageIndexes.map((pi, idx) => (
                <option key={pi} value={idx}>
                  Page {idx + 1}
                </option>
              ))}
            </select>
          </div>

          {/* Content viewer */}
          <div className="flex-1 bg-surface-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="px-5 py-3 border-b border-border-subtle shrink-0">
              <span className="text-xs font-medium text-secondary">
                Page {currentPage + 1} — extracted text
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {currentContent ? (
                <pre className="text-sm text-body whitespace-pre-wrap break-words font-sans leading-relaxed">
                  {currentContent}
                </pre>
              ) : (
                <p className="text-sm text-muted italic">No text content on this page.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Question = {
  id: string;
  stem: string;
  difficulty: string;
  status: string;
  sourceMaterialId: string | null;
  sourcePage: number | null;
  subject: { name: string };
  topic: { name: string };
};

type Subject = { id: string; name: string };
type Topic = { id: string; name: string; subjectId: string };

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    APPROVED:         { label: "Approved",         className: "bg-success-bg text-success border-success-border" },
    PENDING_APPROVAL: { label: "Pending approval", className: "bg-warning-bg text-warning border-warning-border" },
    DRAFT:            { label: "Draft",            className: "bg-surface-base text-secondary border-border" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-surface-base text-secondary border-border" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const map: Record<string, string> = {
    EASY:   "bg-success-bg text-success border-success-border",
    MEDIUM: "bg-warning-bg text-warning border-warning-border",
    HARD:   "bg-error-bg text-error border-error-border",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${map[difficulty] ?? "bg-surface-base text-secondary border-border"}`}>
      {difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}
    </span>
  );
}

const selectClass = "h-9 px-3 text-sm border border-border rounded-lg bg-surface-card text-body focus:outline-none focus:border-border-focus transition-colors";

export default function QuestionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ subjectId: "", topicId: "", difficulty: "", status: "" });

  const loadData = async () => {
    try {
      const searchParams = new URLSearchParams();
      if (filters.subjectId) searchParams.set("subjectId", filters.subjectId);
      if (filters.topicId) searchParams.set("topicId", filters.topicId);
      if (filters.difficulty) searchParams.set("difficulty", filters.difficulty);
      if (filters.status) searchParams.set("status", filters.status);
      const [questionsRes, taxonomyRes] = await Promise.all([
        fetch(`/api/admin/questions?${searchParams.toString()}`),
        fetch("/api/admin/taxonomy"),
      ]);
      const questionsData = await questionsRes.json();
      const taxonomyData = await taxonomyRes.json();
      setQuestions(questionsData.items || []);
      setSubjects(taxonomyData.subjects || []);
      setTopics(taxonomyData.topics || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, filters.subjectId, filters.topicId, filters.difficulty, filters.status]);

  const filterTopicsForFilter = topics.filter((t) => t.subjectId === filters.subjectId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  const approvedCount = questions.filter((q) => q.status === "APPROVED").length;
  const draftCount = questions.filter((q) => q.status === "DRAFT").length;

  return (
    <div className="px-8 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-semibold text-heading">Question Bank</h1>
          <p className="text-sm text-secondary mt-0.5">
            {questions.length} questions {approvedCount > 0 && `\u00B7 ${approvedCount} approved`}
            {draftCount > 0 && ` \u00B7 ${draftCount} pending review`}
          </p>
        </div>
        <Link
          href={`/${params.tenantSlug}/admin/source-materials`}
          className="h-9 px-4 rounded-lg text-sm font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors inline-flex items-center gap-2"
        >
          Upload PDF to add questions
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-surface-card border border-border rounded-xl shadow-sm mb-5 px-5 py-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">Subject</label>
            <select
              value={filters.subjectId}
              onChange={(e) => setFilters({ ...filters, subjectId: e.target.value, topicId: "" })}
              className={`${selectClass} min-w-[140px]`}
            >
              <option value="">All subjects</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">Topic</label>
            <select
              value={filters.topicId}
              onChange={(e) => setFilters({ ...filters, topicId: e.target.value })}
              className={`${selectClass} min-w-[140px]`}
              disabled={!filters.subjectId}
            >
              <option value="">All topics</option>
              {filterTopicsForFilter.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">Difficulty</label>
            <select
              value={filters.difficulty}
              onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
              className={`${selectClass} min-w-[120px]`}
            >
              <option value="">All</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className={`${selectClass} min-w-[150px]`}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Question list */}
      <div className="space-y-2">
        {questions.length === 0 ? (
          <div className="bg-surface-card border border-border rounded-xl px-5 py-12 text-center shadow-sm">
            <p className="text-sm text-secondary mb-1">No questions found.</p>
            <p className="text-xs text-muted">
              Upload a PDF through the Content Pipeline to generate questions automatically.
            </p>
          </div>
        ) : (
          questions.map((q) => (
            <div key={q.id} className="bg-surface-card border border-border rounded-xl px-5 py-4 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-body mb-2.5 leading-snug">{q.stem}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">{q.subject.name}</span>
                    <span className="text-muted text-xs">&middot;</span>
                    <span className="text-xs text-muted">{q.topic.name}</span>
                    <DifficultyBadge difficulty={q.difficulty} />
                    <StatusBadge status={q.status} />
                    {q.sourcePage != null && (
                      <span className="text-[10px] text-muted">p.{q.sourcePage}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

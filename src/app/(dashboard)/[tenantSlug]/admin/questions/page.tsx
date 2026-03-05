"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Question = {
  id: string;
  stem: string;
  difficulty: string;
  status: string;
  subject: { name: string };
  topic: { name: string };
};

type Subject = { id: string; name: string };
type Topic = { id: string; name: string; subjectId: string };
type Subtopic = { id: string; name: string; topicId: string };

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

const inputClass = "h-9 px-3 text-sm border border-border rounded-lg bg-surface-card text-body placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors";
const selectClass = "h-9 px-3 text-sm border border-border rounded-lg bg-surface-card text-body focus:outline-none focus:border-border-focus transition-colors";

export default function QuestionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState({ subjectId: "", topicId: "", difficulty: "", status: "" });
  const [form, setForm] = useState({
    subjectId: "",
    topicId: "",
    subtopicId: "",
    difficulty: "MEDIUM" as "EASY" | "MEDIUM" | "HARD",
    stem: "",
    explanation: "",
    options: [
      { id: "a", text: "", isCorrect: false },
      { id: "b", text: "", isCorrect: false },
      { id: "c", text: "", isCorrect: false },
      { id: "d", text: "", isCorrect: false },
    ],
  });

  const loadData = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.topicId) params.set("topicId", filters.topicId);
      if (filters.difficulty) params.set("difficulty", filters.difficulty);
      if (filters.status) params.set("status", filters.status);
      const [questionsRes, taxonomyRes] = await Promise.all([
        fetch(`/api/admin/questions?${params.toString()}`),
        fetch("/api/admin/taxonomy"),
      ]);
      const questionsData = await questionsRes.json();
      const taxonomyData = await taxonomyRes.json();
      setQuestions(questionsData.items || []);
      setSubjects(taxonomyData.subjects || []);
      setTopics(taxonomyData.topics || []);
      setSubtopics(taxonomyData.subtopics || []);
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
  }, [status, filters.subjectId, filters.topicId, filters.difficulty, filters.status]);

  const createQuestion = async () => {
    const res = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setCreating(false);
      setForm({
        subjectId: "", topicId: "", subtopicId: "", difficulty: "MEDIUM", stem: "", explanation: "",
        options: [
          { id: "a", text: "", isCorrect: false },
          { id: "b", text: "", isCorrect: false },
          { id: "c", text: "", isCorrect: false },
          { id: "d", text: "", isCorrect: false },
        ],
      });
      loadData();
    }
  };

  const submitForApproval = async (questionId: string) => {
    const res = await fetch(`/api/admin/questions/${questionId}/submit-for-approval`, { method: "PATCH" });
    if (res.ok) loadData();
    else alert((await res.json()).error || "Failed");
  };

  const approveQuestion = async (questionId: string) => {
    const res = await fetch(`/api/admin/questions/${questionId}/approve`, { method: "PATCH" });
    if (res.ok) loadData();
    else alert((await res.json()).error || "Failed");
  };

  const filteredTopics = topics.filter((t) => t.subjectId === form.subjectId);
  const filterTopicsForFilter = topics.filter((t) => t.subjectId === filters.subjectId);
  const filteredSubtopics = subtopics.filter((st) => st.topicId === form.topicId);

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
          <h1 className="text-[22px] font-semibold text-heading">Question Bank</h1>
          <p className="text-sm text-secondary mt-0.5">{questions.length} questions</p>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          className={`h-9 px-4 rounded-lg text-sm font-medium transition-colors ${
            creating
              ? "bg-surface-base border border-border text-secondary hover:border-border-strong"
              : "bg-primary text-inverse hover:bg-primary-hover"
          }`}
        >
          {creating ? "Cancel" : "+ Create question"}
        </button>
      </div>

      {/* Create question form */}
      {creating && (
        <div className="bg-surface-card border border-border rounded-xl shadow-sm mb-5">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="text-sm font-semibold text-heading">New question</h2>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-secondary">Subject</label>
                <select
                  value={form.subjectId}
                  onChange={(e) => setForm({ ...form, subjectId: e.target.value, topicId: "", subtopicId: "" })}
                  className={selectClass}
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-secondary">Topic</label>
                <select
                  value={form.topicId}
                  onChange={(e) => setForm({ ...form, topicId: e.target.value, subtopicId: "" })}
                  className={selectClass}
                  disabled={!form.subjectId}
                >
                  <option value="">Select topic</option>
                  {filteredTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-secondary">Subtopic (optional)</label>
                <select
                  value={form.subtopicId}
                  onChange={(e) => setForm({ ...form, subtopicId: e.target.value })}
                  className={selectClass}
                  disabled={!form.topicId}
                >
                  <option value="">Select subtopic</option>
                  {filteredSubtopics.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-secondary">Difficulty</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value as any })}
                  className={selectClass}
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">Question stem</label>
              <textarea
                value={form.stem}
                onChange={(e) => setForm({ ...form, stem: e.target.value })}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-surface-card text-body placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors resize-none"
                rows={3}
                placeholder="Enter the question here…"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-secondary">Answer choices</label>
              {form.options.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={opt.isCorrect}
                    onChange={(e) => {
                      const newOptions = [...form.options];
                      newOptions[idx].isCorrect = e.target.checked;
                      setForm({ ...form, options: newOptions });
                    }}
                    className="w-4 h-4 rounded accent-primary flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => {
                      const newOptions = [...form.options];
                      newOptions[idx].text = e.target.value;
                      setForm({ ...form, options: newOptions });
                    }}
                    placeholder={`Option ${opt.id.toUpperCase()}`}
                    className={`flex-1 ${inputClass}`}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">Explanation (optional)</label>
              <textarea
                value={form.explanation}
                onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-surface-card text-body placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors resize-none"
                rows={2}
                placeholder="Explain the correct answer…"
              />
            </div>

            <div className="pt-1">
              <button
                onClick={createQuestion}
                className="h-9 px-5 rounded-lg text-sm font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors"
              >
                Save question
              </button>
            </div>
          </div>
        </div>
      )}

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
              <option value="PENDING_APPROVAL">Pending approval</option>
              <option value="APPROVED">Approved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Question list */}
      <div className="space-y-2">
        {questions.length === 0 ? (
          <div className="bg-surface-card border border-border rounded-xl px-5 py-12 text-center text-sm text-secondary shadow-sm">
            No questions yet. Create one above.
          </div>
        ) : (
          questions.map((q) => (
            <div key={q.id} className="bg-surface-card border border-border rounded-xl px-5 py-4 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-body mb-2.5 leading-snug">{q.stem}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">{q.subject.name}</span>
                    <span className="text-muted text-xs">·</span>
                    <span className="text-xs text-muted">{q.topic.name}</span>
                    <DifficultyBadge difficulty={q.difficulty} />
                    <StatusBadge status={q.status} />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {q.status === "DRAFT" && (
                    <button
                      onClick={() => submitForApproval(q.id)}
                      className="h-8 px-3 rounded-lg text-xs font-medium bg-warning-bg text-warning border border-warning-border hover:opacity-80 transition-opacity"
                    >
                      Submit for approval
                    </button>
                  )}
                  {q.status === "PENDING_APPROVAL" && (
                    <button
                      onClick={() => approveQuestion(q.id)}
                      className="h-8 px-3 rounded-lg text-xs font-medium bg-success-bg text-success border border-success-border hover:opacity-80 transition-opacity"
                    >
                      Approve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

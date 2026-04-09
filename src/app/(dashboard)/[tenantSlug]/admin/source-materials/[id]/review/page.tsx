"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toUserMessage } from "@/lib/errors";

// --- Types ---

type McqOption = { id: string; text: string; isCorrect: boolean };

type Question = {
  id: string;
  stem: string;
  options: McqOption[];
  explanation: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED";
  sourcePage: number | null;
  subject: { id: string; name: string };
  topic: { id: string; name: string };
};

type FlashcardCard = {
  id: string;
  front: string;
  back: string;
  order: number;
  sourcePage: number | null;
  status: string;
};

type Subject = { id: string; name: string };
type Topic = { id: string; name: string; subjectId: string };

type MaterialInfo = {
  id: string;
  fileName: string;
  status: string;
  questionsGenerated: number | null;
  flashcardsGenerated: number | null;
  questionsApproved: number | null;
  flashcardsApproved: number | null;
};

// --- Components ---

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const map: Record<string, string> = {
    EASY: "bg-success-bg text-success border-success-border",
    MEDIUM: "bg-warning-bg text-warning border-warning-border",
    HARD: "bg-error-bg text-error border-error-border",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${map[difficulty] ?? "bg-surface-base text-secondary border-border"}`}>
      {difficulty}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-surface-base text-secondary border-border" },
    APPROVED: { label: "Approved", className: "bg-success-bg text-success border-success-border" },
    active: { label: "Pending", className: "bg-surface-base text-secondary border-border" },
    rejected: { label: "Rejected", className: "bg-error-bg text-error border-error-border" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-surface-base text-secondary border-border" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// --- Edit Modal ---

function EditQuestionModal({
  question,
  subjects,
  topics,
  onSave,
  onClose,
}: {
  question: Question;
  subjects: Subject[];
  topics: Topic[];
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [stem, setStem] = useState(question.stem);
  const [options, setOptions] = useState(question.options);
  const [explanation, setExplanation] = useState(question.explanation ?? "");
  const [difficulty, setDifficulty] = useState(question.difficulty);
  const [subjectId, setSubjectId] = useState(question.subject.id);
  const [topicId, setTopicId] = useState(question.topic.id);
  const [saving, setSaving] = useState(false);

  const filteredTopics = topics.filter((t) => t.subjectId === subjectId);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(question.id, {
        stem,
        options,
        explanation: explanation || undefined,
        difficulty,
        subjectId,
        topicId,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-card border border-border rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-lg font-semibold text-heading mb-4">Edit Question</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Question Stem</label>
            <textarea
              value={stem}
              onChange={(e) => setStem(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-body bg-surface-base focus:outline-none focus:border-primary min-h-[80px] resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Options</label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOptions(options.map((o, i) => ({
                        ...o,
                        isCorrect: i === idx,
                      })));
                    }}
                    className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      opt.isCorrect ? "border-success bg-success" : "border-border"
                    }`}
                  >
                    {opt.isCorrect && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <input
                    value={opt.text}
                    onChange={(e) => {
                      const newOpts = [...options];
                      newOpts[idx] = { ...opt, text: e.target.value };
                      setOptions(newOpts);
                    }}
                    className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm text-body bg-surface-base focus:outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Explanation</label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-body bg-surface-base focus:outline-none focus:border-primary min-h-[60px] resize-y"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Question["difficulty"])}
                className="w-full border border-border rounded-lg px-3 py-1.5 text-sm text-body bg-surface-base focus:outline-none focus:border-primary"
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Subject</label>
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  const firstTopic = topics.find((t) => t.subjectId === e.target.value);
                  if (firstTopic) setTopicId(firstTopic.id);
                }}
                className="w-full border border-border rounded-lg px-3 py-1.5 text-sm text-body bg-surface-base focus:outline-none focus:border-primary"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Topic</label>
              <select
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-1.5 text-sm text-body bg-surface-base focus:outline-none focus:border-primary"
              >
                {filteredTopics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm font-medium bg-surface-base border border-border text-secondary hover:border-border-strong transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 rounded-lg text-sm font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {saving ? <Spinner size={14} /> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCardModal({
  card,
  onSave,
  onClose,
}: {
  card: FlashcardCard;
  onSave: (id: string, data: { front?: string; back?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(card.id, { front, back });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-card border border-border rounded-xl shadow-lg max-w-lg w-full p-6">
        <h3 className="text-lg font-semibold text-heading mb-4">Edit Flashcard</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Front</label>
            <textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-body bg-surface-base focus:outline-none focus:border-primary min-h-[80px] resize-y"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">Back</label>
            <textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-body bg-surface-base focus:outline-none focus:border-primary min-h-[80px] resize-y"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm font-medium bg-surface-base border border-border text-secondary hover:border-border-strong transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 rounded-lg text-sm font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {saving ? <Spinner size={14} /> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function ReviewPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ tenantSlug: string; id: string }>();
  const tenantSlug = params?.tenantSlug ?? "";
  const sourceMaterialId = params?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [material, setMaterial] = useState<MaterialInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardCard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTab, setActiveTab] = useState<"questions" | "flashcards">("questions");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingCard, setEditingCard] = useState<FlashcardCard | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadContent = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/source-materials/${sourceMaterialId}/generated-content`);
      if (!res.ok) return;
      const data = await res.json();
      setMaterial(data.material);
      setQuestions(data.questions);
      setFlashcards(data.flashcards);
      setSubjects(data.taxonomy.subjects);
      setTopics(data.taxonomy.topics);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [sourceMaterialId]);

  useEffect(() => {
    if (status === "authenticated") loadContent();
  }, [status, loadContent]);

  const handleReview = async (items: Array<{ id: string; type: "question" | "flashcard"; action: "approve" | "reject" }>) => {
    setReviewing(true);
    try {
      const res = await fetch(`/api/admin/source-materials/${sourceMaterialId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(toUserMessage(err, "Review action failed"));
        return;
      }
      setSelectedIds(new Set());
      await loadContent();
    } finally {
      setReviewing(false);
    }
  };

  const handleSingleAction = (id: string, type: "question" | "flashcard", action: "approve" | "reject") => {
    handleReview([{ id, type, action }]);
  };

  const handleBulkAction = (action: "approve" | "reject") => {
    const type = activeTab === "questions" ? "question" : "flashcard";
    const items = Array.from(selectedIds).map((id) => ({ id, type: type as "question" | "flashcard", action }));
    if (items.length === 0) return;
    handleReview(items);
  };

  const handleApproveAllVisible = () => {
    const type = activeTab === "questions" ? "question" : "flashcard";
    const visibleItems = activeTab === "questions"
      ? questions.filter((q) => q.status === "DRAFT").map((q) => ({ id: q.id, type: type as "question" | "flashcard", action: "approve" as const }))
      : flashcards.filter((c) => c.status === "active").map((c) => ({ id: c.id, type: type as "question" | "flashcard", action: "approve" as const }));
    if (visibleItems.length === 0) return;
    handleReview(visibleItems);
  };

  const handleSaveQuestion = async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(toUserMessage(err, "Failed to save question"));
      return;
    }
    await loadContent();
  };

  const handleSaveCard = async (id: string, data: { front?: string; back?: string }) => {
    const res = await fetch(`/api/admin/flashcard-cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(toUserMessage(err, "Failed to save card"));
      return;
    }
    await loadContent();
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (activeTab === "questions") {
      const draftIds = questions.filter((q) => q.status === "DRAFT").map((q) => q.id);
      const allSelected = draftIds.every((id) => selectedIds.has(id));
      if (allSelected) setSelectedIds(new Set());
      else setSelectedIds(new Set(draftIds));
    } else {
      const activeIds = flashcards.filter((c) => c.status === "active").map((c) => c.id);
      const allSelected = activeIds.every((id) => selectedIds.has(id));
      if (allSelected) setSelectedIds(new Set());
      else setSelectedIds(new Set(activeIds));
    }
  };

  // Clear selection when switching tabs
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="px-8 py-8">
        <p className="text-error">Source material not found.</p>
      </div>
    );
  }

  const draftQuestions = questions.filter((q) => q.status === "DRAFT");
  const approvedQuestions = questions.filter((q) => q.status === "APPROVED");
  const pendingFlashcards = flashcards.filter((c) => c.status === "active");
  const rejectedFlashcards = flashcards.filter((c) => c.status === "rejected");
  const isCompleted = material.status === "COMPLETED";

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/${tenantSlug}/admin/source-materials`}
          className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-body transition-colors mb-3"
        >
          <IconArrowLeft />
          Back to Content Pipeline
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold text-heading">{material.fileName}</h1>
            <p className="text-sm text-secondary mt-0.5">
              {isCompleted ? "Review complete" : "Review generated content before publishing"}
            </p>
          </div>

          {/* Summary stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="text-lg font-semibold text-heading">{approvedQuestions.length}</p>
              <p className="text-xs text-secondary">Questions approved</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <p className="text-lg font-semibold text-heading">{material.flashcardsApproved ?? 0}</p>
              <p className="text-xs text-secondary">Flashcards approved</p>
            </div>
            {draftQuestions.length > 0 && (
              <>
                <div className="w-px h-10 bg-border" />
                <div className="text-center">
                  <p className="text-lg font-semibold text-warning">{draftQuestions.length}</p>
                  <p className="text-xs text-secondary">Pending review</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs + bulk actions */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1 bg-surface-base border border-border rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab("questions")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "questions"
                ? "bg-surface-card text-heading shadow-sm"
                : "text-secondary hover:text-body"
            }`}
          >
            Questions ({questions.length})
          </button>
          <button
            onClick={() => setActiveTab("flashcards")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "flashcards"
                ? "bg-surface-card text-heading shadow-sm"
                : "text-secondary hover:text-body"
            }`}
          >
            Flashcards ({flashcards.length})
          </button>
        </div>

        {!isCompleted && (
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <span className="text-xs text-secondary">{selectedIds.size} selected</span>
                <button
                  onClick={() => handleBulkAction("approve")}
                  disabled={reviewing}
                  className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-medium bg-success text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <IconCheck />
                  Approve Selected
                </button>
                <button
                  onClick={() => handleBulkAction("reject")}
                  disabled={reviewing}
                  className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-medium bg-error text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <IconX />
                  Reject Selected
                </button>
              </>
            )}
            <button
              onClick={handleApproveAllVisible}
              disabled={reviewing}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {reviewing ? <Spinner size={12} /> : <IconCheck />}
              Approve All {activeTab === "questions" ? `(${draftQuestions.length})` : `(${pendingFlashcards.length})`}
            </button>
          </div>
        )}
      </div>

      {/* Select all checkbox */}
      {!isCompleted && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={
              activeTab === "questions"
                ? draftQuestions.length > 0 && draftQuestions.every((q) => selectedIds.has(q.id))
                : pendingFlashcards.length > 0 && pendingFlashcards.every((c) => selectedIds.has(c.id))
            }
            onChange={toggleSelectAll}
            className="rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-xs text-secondary">Select all pending</span>
        </div>
      )}

      {/* Questions tab */}
      {activeTab === "questions" && (
        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="bg-surface-card border border-border rounded-xl px-5 py-12 text-center">
              <p className="text-sm text-secondary">No questions generated from this document.</p>
            </div>
          ) : (
            questions.map((q, idx) => (
              <div
                key={q.id}
                className={`bg-surface-card border rounded-xl px-5 py-4 transition-colors ${
                  selectedIds.has(q.id) ? "border-primary/50 bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  {!isCompleted && q.status === "DRAFT" && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(q.id)}
                      onChange={() => toggleSelection(q.id)}
                      className="mt-1 rounded border-border text-primary focus:ring-primary"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-medium text-muted">Q{idx + 1}</span>
                      <DifficultyBadge difficulty={q.difficulty} />
                      <span className="text-xs text-secondary">
                        {q.subject.name} &gt; {q.topic.name}
                      </span>
                      {q.sourcePage != null && (
                        <span className="text-xs text-muted">p.{q.sourcePage}</span>
                      )}
                      <div className="ml-auto">
                        <StatusBadge status={q.status} />
                      </div>
                    </div>

                    {/* Question stem */}
                    <p className="text-sm text-body font-medium mb-2">{q.stem}</p>

                    {/* Options */}
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                      {q.options.map((opt) => (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                            opt.isCorrect
                              ? "bg-success-bg text-success border border-success-border"
                              : "bg-surface-base text-body border border-border"
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                            opt.isCorrect ? "border-success bg-success" : "border-border"
                          }`} />
                          {opt.text}
                        </div>
                      ))}
                    </div>

                    {/* Explanation */}
                    {q.explanation && (
                      <p className="text-xs text-secondary italic mb-2">
                        {q.explanation}
                      </p>
                    )}

                    {/* Actions */}
                    {q.status === "DRAFT" && !isCompleted && (
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => setEditingQuestion(q)}
                          className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium bg-surface-base border border-border text-secondary hover:border-border-strong hover:text-body transition-colors"
                        >
                          <IconEdit />
                          Edit
                        </button>
                        <button
                          onClick={() => handleSingleAction(q.id, "question", "approve")}
                          disabled={reviewing}
                          className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium bg-success/10 text-success border border-success-border hover:bg-success hover:text-white transition-colors disabled:opacity-50"
                        >
                          <IconCheck />
                          Approve
                        </button>
                        <button
                          onClick={() => handleSingleAction(q.id, "question", "reject")}
                          disabled={reviewing}
                          className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium bg-error/10 text-error border border-error-border hover:bg-error hover:text-white transition-colors disabled:opacity-50"
                        >
                          <IconX />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Flashcards tab */}
      {activeTab === "flashcards" && (
        <div className="space-y-3">
          {flashcards.length === 0 ? (
            <div className="bg-surface-card border border-border rounded-xl px-5 py-12 text-center">
              <p className="text-sm text-secondary">No flashcards generated from this document.</p>
            </div>
          ) : (
            flashcards.map((card, idx) => (
              <div
                key={card.id}
                className={`bg-surface-card border rounded-xl px-5 py-4 transition-colors ${
                  card.status === "rejected"
                    ? "opacity-50 border-border"
                    : selectedIds.has(card.id)
                    ? "border-primary/50 bg-primary/5"
                    : "border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  {!isCompleted && card.status === "active" && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(card.id)}
                      onChange={() => toggleSelection(card.id)}
                      className="mt-1 rounded border-border text-primary focus:ring-primary"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-muted">Card {idx + 1}</span>
                      {card.sourcePage != null && (
                        <span className="text-xs text-muted">p.{card.sourcePage}</span>
                      )}
                      <div className="ml-auto">
                        <StatusBadge status={card.status} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">Front</p>
                        <p className="text-sm text-body">{card.front}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">Back</p>
                        <p className="text-sm text-body">{card.back}</p>
                      </div>
                    </div>

                    {card.status === "active" && !isCompleted && (
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => setEditingCard(card)}
                          className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium bg-surface-base border border-border text-secondary hover:border-border-strong hover:text-body transition-colors"
                        >
                          <IconEdit />
                          Edit
                        </button>
                        <button
                          onClick={() => handleSingleAction(card.id, "flashcard", "approve")}
                          disabled={reviewing}
                          className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium bg-success/10 text-success border border-success-border hover:bg-success hover:text-white transition-colors disabled:opacity-50"
                        >
                          <IconCheck />
                          Approve
                        </button>
                        <button
                          onClick={() => handleSingleAction(card.id, "flashcard", "reject")}
                          disabled={reviewing}
                          className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium bg-error/10 text-error border border-error-border hover:bg-error hover:text-white transition-colors disabled:opacity-50"
                        >
                          <IconX />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit modals */}
      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          subjects={subjects}
          topics={topics}
          onSave={handleSaveQuestion}
          onClose={() => setEditingQuestion(null)}
        />
      )}
      {editingCard && (
        <EditCardModal
          card={editingCard}
          onSave={handleSaveCard}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
}

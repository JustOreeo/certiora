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

export default function QuestionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState({
    subjectId: "",
    topicId: "",
    difficulty: "",
    status: "",
  });
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
    if (status === "unauthenticated") {
      router.push("/login");
    }
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
        subjectId: "",
        topicId: "",
        subtopicId: "",
        difficulty: "MEDIUM",
        stem: "",
        explanation: "",
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

  const filteredTopics = topics.filter((t) => t.subjectId === form.subjectId);
  const filterTopicsForFilter = topics.filter((t) => t.subjectId === filters.subjectId);
  const filteredSubtopics = subtopics.filter((st) => st.topicId === form.topicId);

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

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Question Bank</h1>
        <button
          onClick={() => setCreating(!creating)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {creating ? "Cancel" : "+ Create Question"}
        </button>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <select
            value={filters.subjectId}
            onChange={(e) => setFilters({ ...filters, subjectId: e.target.value, topicId: "" })}
            className="px-3 py-2 border rounded min-w-[140px]"
          >
            <option value="">All</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Topic</label>
          <select
            value={filters.topicId}
            onChange={(e) => setFilters({ ...filters, topicId: e.target.value })}
            className="px-3 py-2 border rounded min-w-[140px]"
            disabled={!filters.subjectId}
          >
            <option value="">All</option>
            {filterTopicsForFilter.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Difficulty</label>
          <select
            value={filters.difficulty}
            onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
            className="px-3 py-2 border rounded min-w-[120px]"
          >
            <option value="">All</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border rounded min-w-[140px]"
          >
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending approval</option>
            <option value="APPROVED">Approved</option>
          </select>
        </div>
      </div>

      {creating && (
        <div className="mb-8 p-6 border rounded bg-white">
          <h2 className="text-xl font-semibold mb-4">New Question</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <select
                  value={form.subjectId}
                  onChange={(e) => setForm({ ...form, subjectId: e.target.value, topicId: "", subtopicId: "" })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Topic</label>
                <select
                  value={form.topicId}
                  onChange={(e) => setForm({ ...form, topicId: e.target.value, subtopicId: "" })}
                  className="w-full px-3 py-2 border rounded"
                  disabled={!form.subjectId}
                >
                  <option value="">Select Topic</option>
                  {filteredTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subtopic (optional)</label>
                <select
                  value={form.subtopicId}
                  onChange={(e) => setForm({ ...form, subtopicId: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  disabled={!form.topicId}
                >
                  <option value="">Select Subtopic</option>
                  {filteredSubtopics.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Difficulty</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Question Stem</label>
              <textarea
                value={form.stem}
                onChange={(e) => setForm({ ...form, stem: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Options</label>
              {form.options.map((opt, idx) => (
                <div key={opt.id} className="flex gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={opt.isCorrect}
                    onChange={(e) => {
                      const newOptions = [...form.options];
                      newOptions[idx].isCorrect = e.target.checked;
                      setForm({ ...form, options: newOptions });
                    }}
                    className="mt-3"
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
                    className="flex-1 px-3 py-2 border rounded"
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Explanation (optional)</label>
              <textarea
                value={form.explanation}
                onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                rows={2}
              />
            </div>
            <button onClick={createQuestion} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Save Question
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.id} className="p-4 border rounded bg-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium mb-2">{q.stem}</p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  <span>Subject: {q.subject.name}</span>
                  <span>Topic: {q.topic.name}</span>
                  <span>Difficulty: {q.difficulty}</span>
                  <span
                    className={`px-2 py-1 rounded ${
                      q.status === "APPROVED"
                        ? "bg-green-100 text-green-700"
                        : q.status === "PENDING_APPROVAL"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {q.status.replace("_", " ")}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {q.status === "DRAFT" && (
                  <button
                    onClick={() => submitForApproval(q.id)}
                    className="px-3 py-1 text-sm bg-amber-600 text-white rounded hover:bg-amber-700"
                  >
                    Submit for approval
                  </button>
                )}
                {q.status === "PENDING_APPROVAL" && (
                  <button
                    onClick={() => approveQuestion(q.id)}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Approve
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

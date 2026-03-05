"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Subject = { id: string; name: string; order: number };
type Topic = { id: string; name: string; subjectId: string; order: number };
type Subtopic = { id: string; name: string; topicId: string; order: number };

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

type SectionProps = {
  title: string;
  count: number;
  onAdd: () => void;
  adding: boolean;
  addContent: React.ReactNode;
  children: React.ReactNode;
};

function Section({ title, count, onAdd, adding, addContent, children }: SectionProps) {
  return (
    <div className="bg-surface-card border border-border rounded-xl shadow-sm">
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <h2 className="text-sm font-semibold text-heading">
          {title}{" "}
          <span className="text-secondary font-normal">({count})</span>
        </h2>
        <button
          onClick={onAdd}
          className="inline-flex items-center h-8 px-3 rounded-lg text-xs font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors"
        >
          + Add
        </button>
      </div>
      {adding && (
        <div className="px-5 py-4 border-b border-border-subtle bg-surface-base">
          {addContent}
        </div>
      )}
      {children}
    </div>
  );
}

export default function TaxonomyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<"subject" | "topic" | "subtopic" | null>(null);
  const [editing, setEditing] = useState<{ type: "subject" | "topic" | "subtopic"; id: string; name: string } | null>(null);
  const [newItem, setNewItem] = useState({ name: "", subjectId: "", topicId: "" });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      loadTaxonomy();
    }
  }, [status, router]);

  const loadTaxonomy = async () => {
    try {
      const res = await fetch("/api/admin/taxonomy");
      const data = await res.json();
      setSubjects(data.subjects || []);
      setTopics(data.topics || []);
      setSubtopics(data.subtopics || []);
    } catch (error) {
      console.error("Failed to load taxonomy:", error);
    } finally {
      setLoading(false);
    }
  };

  const createSubject = async () => {
    const res = await fetch("/api/admin/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newItem.name }),
    });
    if (res.ok) {
      setNewItem({ name: "", subjectId: "", topicId: "" });
      setCreating(null);
      loadTaxonomy();
    }
  };

  const createTopic = async () => {
    const res = await fetch("/api/admin/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newItem.name, subjectId: newItem.subjectId }),
    });
    if (res.ok) {
      setNewItem({ name: "", subjectId: "", topicId: "" });
      setCreating(null);
      loadTaxonomy();
    }
  };

  const createSubtopic = async () => {
    const res = await fetch("/api/admin/subtopics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newItem.name, topicId: newItem.topicId }),
    });
    if (res.ok) {
      setNewItem({ name: "", subjectId: "", topicId: "" });
      setCreating(null);
      loadTaxonomy();
    }
  };

  const updateSubject = async (id: string, name: string) => {
    const res = await fetch(`/api/admin/subjects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) { setEditing(null); loadTaxonomy(); }
    else { const d = await res.json(); alert(d.error || "Failed to update"); }
  };

  const updateTopic = async (id: string, name: string) => {
    const res = await fetch(`/api/admin/topics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) { setEditing(null); loadTaxonomy(); }
    else { const d = await res.json(); alert(d.error || "Failed to update"); }
  };

  const updateSubtopic = async (id: string, name: string) => {
    const res = await fetch(`/api/admin/subtopics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) { setEditing(null); loadTaxonomy(); }
    else { const d = await res.json(); alert(d.error || "Failed to update"); }
  };

  const deleteSubject = async (id: string) => {
    if (!confirm("Delete this subject? This will fail if it has questions.")) return;
    const res = await fetch(`/api/admin/subjects/${id}`, { method: "DELETE" });
    if (res.ok) loadTaxonomy();
    else { const d = await res.json(); alert(d.error || "Failed to delete"); }
  };

  const deleteTopic = async (id: string) => {
    if (!confirm("Delete this topic? This will fail if it has questions.")) return;
    const res = await fetch(`/api/admin/topics/${id}`, { method: "DELETE" });
    if (res.ok) loadTaxonomy();
    else { const d = await res.json(); alert(d.error || "Failed to delete"); }
  };

  const deleteSubtopic = async (id: string) => {
    if (!confirm("Delete this subtopic? This will fail if it has questions.")) return;
    const res = await fetch(`/api/admin/subtopics/${id}`, { method: "DELETE" });
    if (res.ok) loadTaxonomy();
    else { const d = await res.json(); alert(d.error || "Failed to delete"); }
  };

  const inputClass = "h-9 px-3 text-sm border border-border rounded-lg bg-surface-card text-body placeholder:text-muted focus:outline-none focus:border-border-focus transition-colors";
  const btnSave = "h-8 px-3 rounded-lg text-xs font-medium bg-primary text-inverse hover:bg-primary-hover transition-colors";
  const btnCancel = "h-8 px-3 rounded-lg text-xs font-medium bg-surface-base border border-border text-secondary hover:border-border-strong transition-colors";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="px-8 py-8 space-y-5">
      <div className="mb-7">
        <h1 className="text-[22px] font-semibold text-heading">Taxonomy</h1>
        <p className="text-sm text-secondary mt-0.5">Manage subjects, topics, and subtopics for your question bank.</p>
      </div>

      {/* Subjects */}
      <Section
        title="Subjects"
        count={subjects.length}
        onAdd={() => { setCreating(creating === "subject" ? null : "subject"); setNewItem({ name: "", subjectId: "", topicId: "" }); }}
        adding={creating === "subject"}
        addContent={
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Subject name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className={`flex-1 ${inputClass}`}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && createSubject()}
            />
            <button onClick={createSubject} className={btnSave}>Save</button>
            <button onClick={() => setCreating(null)} className={btnCancel}>Cancel</button>
          </div>
        }
      >
        {subjects.length === 0 ? (
          <p className="px-5 py-6 text-sm text-secondary text-center">No subjects yet.</p>
        ) : (
          <ul>
            {subjects.map((s, i) => (
              <li key={s.id} className={`px-5 py-3 flex items-center gap-3 ${i > 0 ? "border-t border-border-subtle" : ""}`}>
                {editing?.type === "subject" && editing?.id === s.id ? (
                  <>
                    <input
                      type="text"
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      className={`flex-1 ${inputClass}`}
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && updateSubject(s.id, editing.name)}
                    />
                    <button onClick={() => updateSubject(s.id, editing.name)} className={btnSave}>Save</button>
                    <button onClick={() => setEditing(null)} className={btnCancel}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-body">{s.name}</span>
                    <button onClick={() => setEditing({ type: "subject", id: s.id, name: s.name })} className="text-xs text-secondary hover:text-link transition-colors">Rename</button>
                    <button onClick={() => deleteSubject(s.id)} className="text-xs text-error hover:opacity-80 transition-opacity">Delete</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Topics */}
      <Section
        title="Topics"
        count={topics.length}
        onAdd={() => { setCreating(creating === "topic" ? null : "topic"); setNewItem({ name: "", subjectId: "", topicId: "" }); }}
        adding={creating === "topic"}
        addContent={
          <div className="flex flex-col gap-2">
            <select
              value={newItem.subjectId}
              onChange={(e) => setNewItem({ ...newItem, subjectId: e.target.value })}
              className={inputClass}
            >
              <option value="">Select subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Topic name"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className={`flex-1 ${inputClass}`}
                onKeyDown={(e) => e.key === "Enter" && createTopic()}
              />
              <button onClick={createTopic} className={btnSave}>Save</button>
              <button onClick={() => setCreating(null)} className={btnCancel}>Cancel</button>
            </div>
          </div>
        }
      >
        {topics.length === 0 ? (
          <p className="px-5 py-6 text-sm text-secondary text-center">No topics yet.</p>
        ) : (
          <ul>
            {topics.map((t, i) => {
              const subject = subjects.find((s) => s.id === t.subjectId);
              return (
                <li key={t.id} className={`px-5 py-3 flex items-center gap-3 ${i > 0 ? "border-t border-border-subtle" : ""}`}>
                  {editing?.type === "topic" && editing?.id === t.id ? (
                    <>
                      <input
                        type="text"
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        className={`flex-1 ${inputClass}`}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && updateTopic(t.id, editing.name)}
                      />
                      <button onClick={() => updateTopic(t.id, editing.name)} className={btnSave}>Save</button>
                      <button onClick={() => setEditing(null)} className={btnCancel}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-body">
                        {t.name}
                        {subject && (
                          <span className="ml-2 text-xs text-muted">({subject.name})</span>
                        )}
                      </span>
                      <button onClick={() => setEditing({ type: "topic", id: t.id, name: t.name })} className="text-xs text-secondary hover:text-link transition-colors">Rename</button>
                      <button onClick={() => deleteTopic(t.id)} className="text-xs text-error hover:opacity-80 transition-opacity">Delete</button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Subtopics */}
      <Section
        title="Subtopics"
        count={subtopics.length}
        onAdd={() => { setCreating(creating === "subtopic" ? null : "subtopic"); setNewItem({ name: "", subjectId: "", topicId: "" }); }}
        adding={creating === "subtopic"}
        addContent={
          <div className="flex flex-col gap-2">
            <select
              value={newItem.topicId}
              onChange={(e) => setNewItem({ ...newItem, topicId: e.target.value })}
              className={inputClass}
            >
              <option value="">Select topic</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Subtopic name"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className={`flex-1 ${inputClass}`}
                onKeyDown={(e) => e.key === "Enter" && createSubtopic()}
              />
              <button onClick={createSubtopic} className={btnSave}>Save</button>
              <button onClick={() => setCreating(null)} className={btnCancel}>Cancel</button>
            </div>
          </div>
        }
      >
        {subtopics.length === 0 ? (
          <p className="px-5 py-6 text-sm text-secondary text-center">No subtopics yet.</p>
        ) : (
          <ul>
            {subtopics.map((st, i) => {
              const topic = topics.find((t) => t.id === st.topicId);
              return (
                <li key={st.id} className={`px-5 py-3 flex items-center gap-3 ${i > 0 ? "border-t border-border-subtle" : ""}`}>
                  {editing?.type === "subtopic" && editing?.id === st.id ? (
                    <>
                      <input
                        type="text"
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        className={`flex-1 ${inputClass}`}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && updateSubtopic(st.id, editing.name)}
                      />
                      <button onClick={() => updateSubtopic(st.id, editing.name)} className={btnSave}>Save</button>
                      <button onClick={() => setEditing(null)} className={btnCancel}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-body">
                        {st.name}
                        {topic && (
                          <span className="ml-2 text-xs text-muted">({topic.name})</span>
                        )}
                      </span>
                      <button onClick={() => setEditing({ type: "subtopic", id: st.id, name: st.name })} className="text-xs text-secondary hover:text-link transition-colors">Rename</button>
                      <button onClick={() => deleteSubtopic(st.id)} className="text-xs text-error hover:opacity-80 transition-opacity">Delete</button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

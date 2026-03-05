"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Subject = { id: string; name: string; order: number };
type Topic = { id: string; name: string; subjectId: string; order: number };
type Subtopic = { id: string; name: string; topicId: string; order: number };

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
      router.push("/admin/login");
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
    if (res.ok) {
      setEditing(null);
      loadTaxonomy();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to update");
    }
  };

  const updateTopic = async (id: string, name: string) => {
    const res = await fetch(`/api/admin/topics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setEditing(null);
      loadTaxonomy();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to update");
    }
  };

  const updateSubtopic = async (id: string, name: string) => {
    const res = await fetch(`/api/admin/subtopics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setEditing(null);
      loadTaxonomy();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to update");
    }
  };

  const deleteSubject = async (id: string) => {
    if (!confirm("Delete this subject? This will fail if it has questions.")) return;
    const res = await fetch(`/api/admin/subjects/${id}`, { method: "DELETE" });
    if (res.ok) {
      loadTaxonomy();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
  };

  const deleteTopic = async (id: string) => {
    if (!confirm("Delete this topic? This will fail if it has questions.")) return;
    const res = await fetch(`/api/admin/topics/${id}`, { method: "DELETE" });
    if (res.ok) {
      loadTaxonomy();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
  };

  const deleteSubtopic = async (id: string) => {
    if (!confirm("Delete this subtopic? This will fail if it has questions.")) return;
    const res = await fetch(`/api/admin/subtopics/${id}`, { method: "DELETE" });
    if (res.ok) {
      loadTaxonomy();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Manage Taxonomy</h1>

      {/* Subjects */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Subjects</h2>
          <button
            onClick={() => setCreating("subject")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Subject
          </button>
        </div>
        {creating === "subject" && (
          <div className="mb-4 p-4 border rounded bg-gray-50">
            <input
              type="text"
              placeholder="Subject name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="w-full px-3 py-2 border rounded mb-2"
            />
            <div className="flex gap-2">
              <button onClick={createSubject} className="px-4 py-2 bg-green-600 text-white rounded">
                Save
              </button>
              <button onClick={() => setCreating(null)} className="px-4 py-2 bg-gray-400 text-white rounded">
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {subjects.map((s) => (
            <div key={s.id} className="p-3 border rounded bg-white flex items-center justify-between gap-2">
              {editing?.type === "subject" && editing?.id === s.id ? (
                <>
                  <input
                    type="text"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="flex-1 px-2 py-1 border rounded"
                    autoFocus
                  />
                  <button onClick={() => updateSubject(s.id, editing.name)} className="px-2 py-1 bg-green-600 text-white rounded text-sm">Save</button>
                  <button onClick={() => setEditing(null)} className="px-2 py-1 bg-gray-400 text-white rounded text-sm">Cancel</button>
                </>
              ) : (
                <>
                  <span>{s.name}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing({ type: "subject", id: s.id, name: s.name })} className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded">Rename</button>
                    <button onClick={() => deleteSubject(s.id)} className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded">Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Topics */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Topics</h2>
          <button
            onClick={() => setCreating("topic")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Topic
          </button>
        </div>
        {creating === "topic" && (
          <div className="mb-4 p-4 border rounded bg-gray-50">
            <select
              value={newItem.subjectId}
              onChange={(e) => setNewItem({ ...newItem, subjectId: e.target.value })}
              className="w-full px-3 py-2 border rounded mb-2"
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Topic name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="w-full px-3 py-2 border rounded mb-2"
            />
            <div className="flex gap-2">
              <button onClick={createTopic} className="px-4 py-2 bg-green-600 text-white rounded">
                Save
              </button>
              <button onClick={() => setCreating(null)} className="px-4 py-2 bg-gray-400 text-white rounded">
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {topics.map((t) => {
            const subject = subjects.find((s) => s.id === t.subjectId);
            return (
              <div key={t.id} className="p-3 border rounded bg-white flex items-center justify-between gap-2">
                {editing?.type === "topic" && editing?.id === t.id ? (
                  <>
                    <input
                      type="text"
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      className="flex-1 px-2 py-1 border rounded"
                      autoFocus
                    />
                    <button onClick={() => updateTopic(t.id, editing.name)} className="px-2 py-1 bg-green-600 text-white rounded text-sm">Save</button>
                    <button onClick={() => setEditing(null)} className="px-2 py-1 bg-gray-400 text-white rounded text-sm">Cancel</button>
                  </>
                ) : (
                  <>
                    <span><span className="font-medium">{t.name}</span>
                    <span className="text-sm text-gray-500 ml-2">({subject?.name})</span></span>
                    <div className="flex gap-1">
                      <button onClick={() => setEditing({ type: "topic", id: t.id, name: t.name })} className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded">Rename</button>
                      <button onClick={() => deleteTopic(t.id)} className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded">Delete</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Subtopics */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Subtopics</h2>
          <button
            onClick={() => setCreating("subtopic")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Subtopic
          </button>
        </div>
        {creating === "subtopic" && (
          <div className="mb-4 p-4 border rounded bg-gray-50">
            <select
              value={newItem.topicId}
              onChange={(e) => setNewItem({ ...newItem, topicId: e.target.value })}
              className="w-full px-3 py-2 border rounded mb-2"
            >
              <option value="">Select Topic</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Subtopic name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="w-full px-3 py-2 border rounded mb-2"
            />
            <div className="flex gap-2">
              <button onClick={createSubtopic} className="px-4 py-2 bg-green-600 text-white rounded">
                Save
              </button>
              <button onClick={() => setCreating(null)} className="px-4 py-2 bg-gray-400 text-white rounded">
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {subtopics.map((st) => {
            const topic = topics.find((t) => t.id === st.topicId);
            return (
              <div key={st.id} className="p-3 border rounded bg-white flex items-center justify-between gap-2">
                {editing?.type === "subtopic" && editing?.id === st.id ? (
                  <>
                    <input
                      type="text"
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      className="flex-1 px-2 py-1 border rounded"
                      autoFocus
                    />
                    <button onClick={() => updateSubtopic(st.id, editing.name)} className="px-2 py-1 bg-green-600 text-white rounded text-sm">Save</button>
                    <button onClick={() => setEditing(null)} className="px-2 py-1 bg-gray-400 text-white rounded text-sm">Cancel</button>
                  </>
                ) : (
                  <>
                    <span><span className="font-medium">{st.name}</span>
                    <span className="text-sm text-gray-500 ml-2">({topic?.name})</span></span>
                    <div className="flex gap-1">
                      <button onClick={() => setEditing({ type: "subtopic", id: st.id, name: st.name })} className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded">Rename</button>
                      <button onClick={() => deleteSubtopic(st.id)} className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded">Delete</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

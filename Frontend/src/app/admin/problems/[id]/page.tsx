"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetchSafe, apiFetch, getAuthToken } from "@/lib/api";
import type { ProblemDetail, TestCase } from "@/lib/types";
import {
  LoadingSpinner, EmptyState, DifficultyBadge, ErrorBanner, SuccessBanner, ConfirmDialog, Toast,
} from "@/components/admin/AdminUI";

export default function AdminProblemDetailPage() {
  const params = useParams();
  const problemId = (params?.id as string) || "";

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Add form
  const [showAddTC, setShowAddTC] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addOutput, setAddOutput] = useState("");
  const [addHidden, setAddHidden] = useState(true);
  const [addLoading, setAddLoading] = useState(false);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [editOutput, setEditOutput] = useState("");
  const [editHidden, setEditHidden] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirm
  const [deleteTCId, setDeleteTCId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [pData, tcData] = await Promise.all([
      apiFetchSafe<ProblemDetail>(`/problems/${problemId}`),
      apiFetchSafe<TestCase[]>(`/problems/${problemId}/testcases?include_hidden=true`),
    ]);
    if (pData) setProblem(pData);
    else setError("Problem not found");
    if (tcData) setTestCases(tcData);
    setLoading(false);
  }, [problemId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- Add ----
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInput.trim() || !addOutput.trim()) {
      setToast({ msg: "Test case input and output are required.", type: "error" });
      return;
    }
    setAddLoading(true);
    try {
      await apiFetch(`/admin/problems/${problemId}/testcases`, {
        method: "POST",
        body: JSON.stringify({
          input: addInput.trim(),
          expected_output: addOutput.trim(),
          is_hidden: addHidden,
        }),
        token: getAuthToken(),
      });
      setToast({ msg: "Test case added.", type: "success" });
      setAddInput("");
      setAddOutput("");
      setAddHidden(true);
      setShowAddTC(false);
      loadData();
    } catch (err: any) {
      setToast({ msg: err.message || "Failed to add test case.", type: "error" });
    } finally {
      setAddLoading(false);
    }
  };

  // ---- Edit ----
  const startEdit = (tc: TestCase) => {
    setEditingId(tc.id);
    setEditInput(tc.input);
    setEditOutput(tc.expected_output);
    setEditHidden(tc.is_hidden);
    setError("");
    setSuccess("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditInput("");
    setEditOutput("");
    setEditHidden(false);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!editInput.trim() || !editOutput.trim()) {
      setToast({ msg: "Input and output are required.", type: "error" });
      return;
    }
    setEditLoading(true);
    try {
      await apiFetch(`/admin/problems/${problemId}/testcases/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({
          input: editInput.trim(),
          expected_output: editOutput.trim(),
          is_hidden: editHidden,
        }),
        token: getAuthToken(),
      });
      setToast({ msg: "Test case updated.", type: "success" });
      cancelEdit();
      loadData();
    } catch (err: any) {
      setToast({ msg: err.message || "Failed to update test case.", type: "error" });
    } finally {
      setEditLoading(false);
    }
  };

  // ---- Delete ----
  const confirmDelete = async () => {
    if (!deleteTCId) return;
    try {
      await apiFetch(`/admin/problems/${problemId}/testcases/${deleteTCId}`, {
        method: "DELETE",
        token: getAuthToken(),
      });
      setToast({ msg: "Test case deleted.", type: "success" });
      setTestCases(testCases.filter((t) => t.id !== deleteTCId));
    } catch (err: any) {
      setToast({ msg: err.message || "Failed to delete test case.", type: "error" });
    }
    setDeleteTCId(null);
  };

  if (loading) return <LoadingSpinner label="Loading problem..." />;

  if (!problem) {
    return (
      <div>
        <Link href="/admin/problems" className="text-xs text-zinc-400 hover:text-zinc-200">← Back to Question Bank</Link>
        <div className="mt-8"><EmptyState title="Problem not found" /></div>
      </div>
    );
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/admin/problems" className="hover:text-zinc-300 transition">Question Bank</Link>
        <span>/</span>
        <span className="font-mono text-zinc-300">{problemId}</span>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{problem.title}</h1>
              <DifficultyBadge difficulty={problem.difficulty} />
            </div>
            <p className="mt-1 text-[11px] font-mono text-zinc-500">ID: {problem.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/problems/${problemId}/edit`}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
            >
              Edit Problem
            </Link>
            <Link
              href={`/problems/${problemId}`}
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
            >
              Preview Public →
            </Link>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
        <h3 className="text-sm font-semibold text-zinc-100 mb-3">Problem Statement</h3>
        <p className="whitespace-pre-wrap text-xs text-zinc-300 leading-relaxed">{problem.description}</p>
      </div>

      {/* All Test Cases */}
      <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-800 p-5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">All Test Cases ({testCases.length})</h3>
            <p className="text-xs text-zinc-500">Including hidden test cases — full CRUD</p>
          </div>
          <button
            onClick={() => setShowAddTC(!showAddTC)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
          >
            + Add Test Case
          </button>
        </div>

        {error && <div className="m-4"><ErrorBanner message={error} /></div>}

        {/* Add form */}
        {showAddTC && (
          <div className="border-b border-zinc-800 p-4 bg-zinc-950/50">
            <form onSubmit={handleAdd} className="space-y-3">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox" checked={addHidden}
                  onChange={(e) => setAddHidden(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 accent-zinc-100"
                />
                <span className="text-zinc-400">{addHidden ? "Hidden test case" : "Public sample case"}</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Input</label>
                  <textarea
                    rows={3} value={addInput} onChange={(e) => setAddInput(e.target.value)}
                    className="w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-xs font-mono text-zinc-200 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Expected Output</label>
                  <textarea
                    rows={3} value={addOutput} onChange={(e) => setAddOutput(e.target.value)}
                    className="w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-xs font-mono text-zinc-200 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit" disabled={addLoading}
                  className="rounded-md bg-zinc-100 px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition disabled:opacity-50"
                >
                  {addLoading ? "Adding…" : "Add Test Case"}
                </button>
                <button
                  type="button" onClick={() => setShowAddTC(false)}
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Test case list */}
        <div className="divide-y divide-zinc-800/60">
          {testCases.length > 0 ? (
            testCases.map((tc, i) => {
              const isEditing = editingId === tc.id;
              return (
                <div key={tc.id} className="p-4 hover:bg-zinc-900/40 transition">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-zinc-500">#{i + 1}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase ${
                        tc.is_hidden ? "bg-zinc-800 text-zinc-400" : "bg-emerald-950/30 text-emerald-400"
                      }`}>
                        {tc.is_hidden ? "Hidden" : "Public"}
                      </span>
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => startEdit(tc)}
                          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTCId(tc.id)}
                          className="rounded border border-red-900/40 bg-red-950/20 px-2 py-1 text-[10px] text-red-400 hover:bg-red-950/40 transition"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    // Inline edit mode
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox" checked={editHidden}
                          onChange={(e) => setEditHidden(e.target.checked)}
                          className="rounded border-zinc-700 bg-zinc-900 accent-zinc-100"
                        />
                        <span className="text-zinc-400">{editHidden ? "Hidden" : "Public"}</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Input</label>
                          <textarea
                            rows={3} value={editInput} onChange={(e) => setEditInput(e.target.value)}
                            className="w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-xs font-mono text-zinc-200 focus:border-zinc-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Expected Output</label>
                          <textarea
                            rows={3} value={editOutput} onChange={(e) => setEditOutput(e.target.value)}
                            className="w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-xs font-mono text-zinc-200 focus:border-zinc-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveEdit} disabled={editLoading}
                          className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition disabled:opacity-50"
                        >
                          {editLoading ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Read-only view
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-zinc-400">Input</span>
                        <pre className="mt-1 rounded bg-zinc-950 border border-zinc-800/60 p-2 text-xs font-mono text-zinc-200 overflow-x-auto">{tc.input}</pre>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400">Expected Output</span>
                        <pre className="mt-1 rounded bg-zinc-950 border border-zinc-800/60 p-2 text-xs font-mono text-zinc-200 overflow-x-auto">{tc.expected_output}</pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-zinc-500">No test cases found. Add one to get started.</div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTCId}
        title="Delete Test Case"
        message="Remove this test case? This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTCId(null)}
      />
    </div>
  );
}

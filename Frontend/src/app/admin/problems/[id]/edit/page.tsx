"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetchSafe, apiFetch, getAuthToken } from "@/lib/api";
import type { ProblemDetail } from "@/lib/types";
import { LoadingSpinner, ErrorBanner, SuccessBanner } from "@/components/admin/AdminUI";

export default function AdminEditProblemPage() {
  const params = useParams();
  const router = useRouter();
  const problemId = (params?.id as string) || "";

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");

  useEffect(() => {
    async function loadData() {
      const data = await apiFetchSafe<ProblemDetail>(`/problems/${problemId}`);
      if (data) {
        setProblem(data);
        setTitle(data.title);
        setDescription(data.description);
        setDifficulty(data.difficulty);
      }
      setLoading(false);
    }
    loadData();
  }, [problemId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/admin/problems/${problemId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          difficulty,
        }),
        token: getAuthToken(),
      });
      setSuccess("Problem updated successfully.");
      setTimeout(() => router.push(`/admin/problems/${problemId}`), 1200);
    } catch (err: any) {
      setError(err.message || "Failed to update problem.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner label="Loading problem..." />;

  if (!problem) {
    return (
      <div>
        <Link href="/admin/problems" className="text-xs text-zinc-400 hover:text-zinc-200">← Back to Question Bank</Link>
        <p className="mt-8 text-sm text-zinc-500">Problem not found.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/admin/problems" className="hover:text-zinc-300 transition">Question Bank</Link>
        <span>/</span>
        <Link href={`/admin/problems/${problemId}`} className="hover:text-zinc-300 transition font-mono">{problemId}</Link>
        <span>/</span>
        <span className="text-zinc-300">Edit</span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Edit Problem</h1>
      <p className="mt-1.5 text-xs text-zinc-400">
        Update problem details. Manage test cases on the{" "}
        <Link href={`/admin/problems/${problemId}`} className="text-zinc-300 underline">
          problem detail page
        </Link>.
      </p>

      <div className="mt-8 max-w-3xl rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        {success && <div className="mb-4"><SuccessBanner message={success} /></div>}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Problem ID</label>
            <input
              type="text" disabled value={problem.id}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs font-mono text-zinc-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Title</label>
            <input
              type="text" required value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Difficulty</label>
            <select
              value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Description & Constraints</label>
            <textarea
              required rows={8} value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none resize-y"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit" disabled={saving}
              className="rounded-md bg-zinc-100 px-5 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <Link
              href={`/admin/problems/${problemId}`}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, getAuthToken } from "@/lib/api";
import { ErrorBanner, SuccessBanner } from "@/components/admin/AdminUI";

interface TestCaseForm {
  input: string;
  expected_output: string;
  is_hidden: boolean;
}

export default function AdminNewProblemPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [testCases, setTestCases] = useState<TestCaseForm[]>([
    { input: "", expected_output: "", is_hidden: false },
    { input: "", expected_output: "", is_hidden: true },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateTestCase(idx: number, field: keyof TestCaseForm, value: string | boolean) {
    setTestCases((prev) => prev.map((tc, i) => (i === idx ? { ...tc, [field]: value } : tc)));
  }

  function addTestCase() {
    setTestCases([...testCases, { input: "", expected_output: "", is_hidden: true }]);
  }

  function removeTestCase(idx: number) {
    setTestCases(testCases.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!id.trim() || !title.trim() || !description.trim()) {
      setError("ID, title, and description are required.");
      return;
    }

    // Validate test cases that have content
    const validTestCases = testCases.filter(
      (tc) => tc.input.trim() && tc.expected_output.trim()
    );

    setLoading(true);
    try {
      await apiFetch("/admin/problems", {
        method: "POST",
        body: JSON.stringify({
          id: id.trim(),
          title: title.trim(),
          description: description.trim(),
          difficulty,
          test_cases: validTestCases.map((tc) => ({
            input: tc.input.trim(),
            expected_output: tc.expected_output.trim(),
            is_hidden: tc.is_hidden,
          })),
        }),
        token: getAuthToken(),
      });
      setSuccess(`Problem "${title}" created successfully.`);
      setTimeout(() => router.push("/admin/problems"), 1500);
    } catch (err: any) {
      setError(err.message || "Failed to create problem");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/admin/problems" className="hover:text-zinc-300 transition">Question Bank</Link>
        <span>/</span>
        <span className="text-zinc-300">New Problem</span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Create New Problem</h1>
      <p className="mt-1.5 text-xs text-zinc-400">Add a problem with test cases to the question bank.</p>

      <div className="mt-8 max-w-3xl">
        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        {success && <div className="mb-4"><SuccessBanner message={success} /></div>}

        <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Problem ID (Slug)</label>
              <input
                type="text" required value={id} onChange={(e) => setId(e.target.value)}
                placeholder="valid-parentheses"
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
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
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Title</label>
            <input
              type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Valid Parentheses"
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Description & Constraints</label>
            <textarea
              required rows={5} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Problem statement with input/output format and constraints..."
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          {/* Test Cases */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-zinc-400">Test Cases</label>
              <button
                type="button"
                onClick={addTestCase}
                className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700 transition"
              >
                + Add Test Case
              </button>
            </div>
            <div className="space-y-3">
              {testCases.map((tc, idx) => (
                <div key={idx} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox" checked={tc.is_hidden}
                        onChange={(e) => updateTestCase(idx, "is_hidden", e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-900 text-zinc-100"
                      />
                      <span className="text-zinc-400">{tc.is_hidden ? "Hidden (secret)" : "Public (visible to students)"}</span>
                    </label>
                    {testCases.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTestCase(idx)}
                        className="text-[11px] text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">Input</label>
                      <textarea
                        rows={2} value={tc.input}
                        onChange={(e) => updateTestCase(idx, "input", e.target.value)}
                        className="w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-xs font-mono text-zinc-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">Expected Output</label>
                      <textarea
                        rows={2} value={tc.expected_output}
                        onChange={(e) => updateTestCase(idx, "expected_output", e.target.value)}
                        className="w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-xs font-mono text-zinc-200 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit" disabled={loading}
              className="rounded-md bg-zinc-100 px-5 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Problem"}
            </button>
            <Link
              href="/admin/problems"
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

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetchSafe, API_BASE_URL, getAuthToken } from "@/lib/api";
import type { ProblemDetail, TestCase, TestCaseInput } from "@/lib/types";
import { LoadingSpinner, EmptyState, DifficultyBadge, ErrorBanner, SuccessBanner } from "@/components/admin/AdminUI";

export default function AdminProblemDetailPage() {
  const params = useParams();
  const problemId = (params?.id as string) || "";

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New test case form
  const [showAddTC, setShowAddTC] = useState(false);
  const [tcInput, setTcInput] = useState("");
  const [tcOutput, setTcOutput] = useState("");
  const [tcHidden, setTcHidden] = useState(true);
  const [tcLoading, setTcLoading] = useState(false);

  async function loadData() {
    const [pData] = await Promise.all([
      apiFetchSafe<ProblemDetail>(`/problems/${problemId}`),
    ]);
    if (pData) setProblem(pData);
    else setError("Problem not found");

    // Fetch all test cases including hidden — needs auth token, backend may not enforce
    try {
      const tcRes = await fetch(`${API_BASE_URL}/problems/${problemId}/testcases?include_hidden=true`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (tcRes.ok) {
        setTestCases(await tcRes.json());
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [problemId]);

  async function handleAddTestCase(e: React.FormEvent) {
    e.preventDefault();
    if (!tcInput.trim() || !tcOutput.trim()) {
      setError("Test case input and output are required.");
      return;
    }
    setTcLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/admin/problems/${problemId}/testcases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          input: tcInput.trim(),
          expected_output: tcOutput.trim(),
          is_hidden: tcHidden,
        }),
      });
      if (res.ok) {
        setSuccess("Test case added successfully.");
        setTcInput("");
        setTcOutput("");
        setShowAddTC(false);
        loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Failed to add test case");
      }
    } catch {
      setError("Failed to reach backend.");
    } finally {
      setTcLoading(false);
    }
  }

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

      {/* Sample test cases */}
      {problem.sample_test_cases && problem.sample_test_cases.length > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
          <h3 className="text-sm font-semibold text-zinc-100 mb-3">Sample Test Cases (Public)</h3>
          <div className="space-y-3">
            {problem.sample_test_cases.map((tc, i) => (
              <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3.5">
                <p className="text-[11px] text-zinc-500 mb-1">Example {i + 1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-zinc-400">Input:</span>
                    <pre className="mt-1 rounded bg-zinc-950 border border-zinc-800/60 p-2 text-xs font-mono text-zinc-200">{tc.input}</pre>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400">Expected Output:</span>
                    <pre className="mt-1 rounded bg-zinc-950 border border-zinc-800/60 p-2 text-xs font-mono text-zinc-200">{tc.expected_output}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Test Cases */}
      <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-800 p-5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">All Test Cases ({testCases.length})</h3>
            <p className="text-xs text-zinc-500">Including hidden test cases</p>
          </div>
          <button
            onClick={() => setShowAddTC(!showAddTC)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
          >
            + Add Test Case
          </button>
        </div>

        {error && <div className="m-4"><ErrorBanner message={error} /></div>}
        {success && <div className="m-4"><SuccessBanner message={success} /></div>}

        {showAddTC && (
          <div className="border-b border-zinc-800 p-4 bg-zinc-950/50">
            <form onSubmit={handleAddTestCase} className="space-y-3">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox" checked={tcHidden}
                  onChange={(e) => setTcHidden(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-zinc-100"
                />
                <span className="text-zinc-400">{tcHidden ? "Hidden test case" : "Public sample case"}</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Input</label>
                  <textarea
                    rows={3} value={tcInput} onChange={(e) => setTcInput(e.target.value)}
                    className="w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-xs font-mono text-zinc-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Expected Output</label>
                  <textarea
                    rows={3} value={tcOutput} onChange={(e) => setTcOutput(e.target.value)}
                    className="w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-xs font-mono text-zinc-200 focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit" disabled={tcLoading}
                className="rounded-md bg-zinc-100 px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {tcLoading ? "Adding..." : "Add Test Case"}
              </button>
            </form>
          </div>
        )}

        <div className="divide-y divide-zinc-800/60">
          {testCases.length > 0 ? (
            testCases.map((tc, i) => (
              <div key={tc.id} className="p-4 hover:bg-zinc-900/40 transition">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[11px] font-mono text-zinc-500">Test Case #{i + 1}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase ${
                    tc.is_hidden ? "bg-zinc-800 text-zinc-400" : "bg-emerald-950/30 text-emerald-400"
                  }`}>
                    {tc.is_hidden ? "Hidden" : "Public"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-zinc-400">Input:</span>
                    <pre className="mt-1 rounded bg-zinc-950 border border-zinc-800/60 p-2 text-xs font-mono text-zinc-200 overflow-x-auto">{tc.input}</pre>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400">Expected Output:</span>
                    <pre className="mt-1 rounded bg-zinc-950 border border-zinc-800/60 p-2 text-xs font-mono text-zinc-200 overflow-x-auto">{tc.expected_output}</pre>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-zinc-500">No test cases found. Add one to get started.</div>
          )}
        </div>
      </div>
    </div>
  );
}

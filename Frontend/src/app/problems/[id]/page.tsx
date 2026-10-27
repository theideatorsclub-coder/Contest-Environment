"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import { apiFetch, apiFetchSafe, getCurrentUser } from "@/lib/api";
import type { ProblemDetail, SubmissionStatusResponse } from "@/lib/types";

// ---- Language config ----
const LANGUAGES = [
  { id: 71, label: "Python 3" },
  { id: 54, label: "C++ (GCC)" },
  { id: 50, label: "C (GCC)" },
  { id: 62, label: "Java" },
  { id: 63, label: "JavaScript" },
];

const STARTER_CODES: Record<number, string> = {
  71: `# Python 3
import sys

def solve():
    data = sys.stdin.read().strip()
    # write your solution here
    print(data)

solve()
`,
  54: `// C++ (GCC)
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    // write your solution here
    string line;
    while (getline(cin, line)) cout << line << "\\n";
    return 0;
}
`,
  50: `// C (GCC)
#include <stdio.h>

int main() {
    // write your solution here
    char line[1000];
    while (fgets(line, sizeof(line), stdin)) {
        printf("%s", line);
    }
    return 0;
}
`,
  62: `// Java
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // write your solution here
        while (sc.hasNextLine()) System.out.println(sc.nextLine());
    }
}
`,
  63: `// JavaScript (Node.js)
const lines = require('fs').readFileSync(0, 'utf-8').trim().split('\\n');
// write your solution here
lines.forEach(l => console.log(l));
`,
};

const PENDING_STATUSES = new Set(["PENDING", "IN_QUEUE", "PROCESSING"]);

// ---- Status badge ----
function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s.includes("ACCEPT"))
    return <span className="rounded border border-emerald-900/40 bg-emerald-950/30 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-400">Accepted ✓</span>;
  if (s.includes("WRONG"))
    return <span className="rounded border border-red-900/40 bg-red-950/30 px-2 py-0.5 font-mono text-[11px] font-semibold text-red-400">Wrong Answer</span>;
  if (s.includes("COMPILATION"))
    return <span className="rounded border border-orange-900/40 bg-orange-950/30 px-2 py-0.5 font-mono text-[11px] font-semibold text-orange-400">Compilation Error</span>;
  if (s.includes("TIME"))
    return <span className="rounded border border-amber-900/40 bg-amber-950/30 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-400">Time Limit Exceeded</span>;
  if (s.includes("RUNTIME"))
    return <span className="rounded border border-red-900/40 bg-red-950/30 px-2 py-0.5 font-mono text-[11px] font-semibold text-red-300">Runtime Error</span>;
  if (s === "PENDING" || s === "IN_QUEUE")
    return <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[11px] text-zinc-400">Queued…</span>;
  if (s === "PROCESSING")
    return <span className="rounded border border-blue-900/40 bg-blue-950/30 px-2 py-0.5 font-mono text-[11px] text-blue-400">Judging…</span>;
  return <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[11px] text-zinc-300">{status}</span>;
}

export default function ProblemWorkspacePage() {
  const { id: problemId } = useParams() as { id: string };

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [langId, setLangId] = useState(71);
  const [code, setCode] = useState(STARTER_CODES[71]);
  const [customInput, setCustomInput] = useState("");
  const [activeTab, setActiveTab] = useState<"input" | "result">("input");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [submitError, setSubmitError] = useState("");

  // Load problem
  useEffect(() => {
    if (!problemId) return;
    async function load() {
      const data = await apiFetchSafe<ProblemDetail>(`/problems/${problemId}`);
      if (data) {
        setProblem(data);
        if (data.sample_test_cases?.length) setCustomInput(data.sample_test_cases[0].input);
      } else {
        setLoadError("Problem not found or server unavailable.");
      }
    }
    load();
  }, [problemId]);

  const handleLangChange = useCallback((id: number) => {
    setLangId(id);
    setCode(STARTER_CODES[id] || "");
  }, []);

  // Run code against custom stdin
  const handleRun = async () => {
    setRunning(true);
    setActiveTab("result");
    setResult({ status: "Running…" });
    setSubmitError("");
    try {
      const data = await apiFetch("/run", {
        method: "POST",
        body: JSON.stringify({ source_code: code, language_id: langId, stdin: customInput }),
      });
      setResult(data);
    } catch (err: any) {
      setResult({ status: "Error", stderr: err.message || "Could not reach the execution server." });
    } finally {
      setRunning(false);
    }
  };

  // Submit and poll for verdict
  const handleSubmit = async () => {
    setSubmitting(true);
    setActiveTab("result");
    setResult({ status: "PENDING" });
    setSubmitError("");

    const user = getCurrentUser();
    if (!user) {
      setSubmitError("You must be logged in to submit.");
      setSubmitting(false);
      return;
    }

    try {
      const submitData = await apiFetch("/submit", {
        method: "POST",
        body: JSON.stringify({
          problem_id: problemId,
          user_id: user.userId,
          language_id: langId,
          source_code: code,
        }),
      });

      const submissionId: string = submitData.submission_id;
      setResult({ status: "IN_QUEUE" });

      // Poll every 1.5s, max 20 attempts (~30s)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const pollData = await apiFetch<SubmissionStatusResponse>(`/status/${submissionId}`);
          setResult(pollData);
          if (!PENDING_STATUSES.has(pollData.status)) {
            clearInterval(poll);
            setSubmitting(false);
          }
        } catch { /* keep polling */ }
        if (attempts >= 20) {
          clearInterval(poll);
          setSubmitting(false);
          setSubmitError("Judging timed out. Check submissions later.");
        }
      }, 1500);
    } catch (err: any) {
      setResult(null);
      setSubmitError(err.message || "Submission failed. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <AuthGuard>
      <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
        <Navbar />

        {/* Top ribbon */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-5 py-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <Link href="/problems" className="text-zinc-400 hover:text-zinc-200 transition">
              ← Problem Bank
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-200 font-medium">{problem?.title ?? problemId}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
            Judge0 Engine
          </div>
        </div>

        {loadError && (
          <div className="px-6 py-3 text-xs text-red-400 border-b border-zinc-800 bg-red-950/10">{loadError}</div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* LEFT — Problem statement */}
          <div className="w-[45%] border-r border-zinc-800/80 flex flex-col overflow-y-auto bg-zinc-950">
            <div className="p-5 border-b border-zinc-800/60 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  problem?.difficulty === "Easy" ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/40"
                  : problem?.difficulty === "Medium" ? "bg-amber-950/30 text-amber-400 border-amber-900/40"
                  : "bg-red-950/30 text-red-400 border-red-900/40"
                }`}>
                  {problem?.difficulty ?? "—"}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">Practice</span>
              </div>
              <h1 className="text-lg font-semibold text-zinc-100">{problem?.title ?? "Loading…"}</h1>
            </div>

            <div className="p-5 space-y-6 text-xs text-zinc-300 leading-relaxed">
              {problem?.description && (
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-2">Problem Statement</p>
                  <p className="whitespace-pre-wrap">{problem.description}</p>
                </div>
              )}

              {problem?.sample_test_cases && problem.sample_test_cases.length > 0 && (
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-3">Sample Test Cases</p>
                  <div className="space-y-3">
                    {problem.sample_test_cases.map((tc, i) => (
                      <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 font-mono">
                        <p className="text-[10px] text-zinc-500 mb-2">Example {i + 1}</p>
                        <p className="text-[10px] text-zinc-400">Input</p>
                        <pre className="mt-1 rounded bg-zinc-950 border border-zinc-800/60 p-2 text-zinc-200 overflow-x-auto">{tc.input}</pre>
                        <p className="text-[10px] text-zinc-400 mt-2">Expected Output</p>
                        <pre className="mt-1 rounded bg-zinc-950 border border-zinc-800/60 p-2 text-zinc-200 overflow-x-auto">{tc.expected_output}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Editor + console */}
          <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
            {/* Editor toolbar */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-2 bg-zinc-900/40 shrink-0">
              <select
                value={langId}
                onChange={(e) => handleLangChange(Number(e.target.value))}
                className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 font-mono focus:border-zinc-500 focus:outline-none"
              >
                {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRun}
                  disabled={running || submitting}
                  className="rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition disabled:opacity-40"
                >
                  {running ? "Running…" : "▶ Run"}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={running || submitting}
                  className="rounded bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition disabled:opacity-40"
                >
                  {submitting ? "Judging…" : "Submit"}
                </button>
              </div>
            </div>

            {/* Code editor */}
            <div className="flex-1 overflow-hidden p-4">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="w-full h-full bg-transparent text-zinc-200 resize-none focus:outline-none font-mono text-xs leading-relaxed selection:bg-zinc-800"
              />
            </div>

            {/* Console */}
            <div className="h-52 border-t border-zinc-800/80 flex flex-col shrink-0 bg-zinc-900/20">
              <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-2 bg-zinc-950 shrink-0">
                <div className="flex gap-2">
                  {(["input", "result"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition ${activeTab === t ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
                    >
                      {t === "input" ? "Custom Input" : "Result"}
                    </button>
                  ))}
                </div>
                {result?.status && <StatusBadge status={result.status} />}
              </div>

              <div className="flex-1 p-3 overflow-y-auto font-mono text-xs">
                {activeTab === "input" ? (
                  <textarea
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="Paste custom stdin here…"
                    className="w-full h-full bg-transparent resize-none focus:outline-none placeholder-zinc-600 text-zinc-300"
                  />
                ) : (
                  <div className="space-y-2">
                    {submitError && (
                      <p className="text-red-400">{submitError}</p>
                    )}
                    {result?.stdout && (
                      <div>
                        <p className="text-[10px] uppercase text-zinc-500 mb-1">Stdout</p>
                        <pre className="rounded bg-zinc-950 border border-zinc-800/80 p-2 text-zinc-200 whitespace-pre-wrap overflow-x-auto">{result.stdout}</pre>
                      </div>
                    )}
                    {result?.stderr && (
                      <div>
                        <p className="text-[10px] uppercase text-red-400 mb-1">Stderr</p>
                        <pre className="rounded bg-red-950/20 border border-red-900/40 p-2 text-red-300 whitespace-pre-wrap overflow-x-auto">{result.stderr}</pre>
                      </div>
                    )}
                    {result?.compile_output && (
                      <div>
                        <p className="text-[10px] uppercase text-orange-400 mb-1">Compiler</p>
                        <pre className="rounded bg-orange-950/20 border border-orange-900/40 p-2 text-orange-300 whitespace-pre-wrap overflow-x-auto">{result.compile_output}</pre>
                      </div>
                    )}
                    {result?.execution_time && (
                      <p className="text-[10px] text-zinc-500 font-mono">
                        Time: {result.execution_time}s · Memory: {result.memory ?? "—"} KB
                      </p>
                    )}
                    {!result && !submitError && (
                      <p className="text-zinc-600">Run or Submit to see output.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

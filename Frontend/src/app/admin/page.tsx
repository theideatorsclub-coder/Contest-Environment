"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"contest" | "problem" | "list">("contest");

  // Contest Form State
  const [contestId, setContestId] = useState("");
  const [contestTitle, setContestTitle] = useState("");
  const [contestDesc, setContestDesc] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);

  // Problem Form State
  const [problemId, setProblemId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [sampleInput, setSampleInput] = useState("");
  const [sampleOutput, setSampleOutput] = useState("");
  const [hiddenInput, setHiddenInput] = useState("");
  const [hiddenOutput, setHiddenOutput] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [problems, setProblems] = useState<any[]>([]);
  const [contests, setContests] = useState<any[]>([]);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    const checkUser = () => {
      const stored = localStorage.getItem("tic_user");
      if (stored) {
        try {
          setCurrentUser(JSON.parse(stored));
        } catch {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setCheckedAuth(true);
    };

    checkUser();
    window.addEventListener("storage", checkUser);
    window.addEventListener("auth-change", checkUser);
    return () => {
      window.removeEventListener("storage", checkUser);
      window.removeEventListener("auth-change", checkUser);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [probRes, contestRes] = await Promise.all([
        fetch("http://localhost:8000/problems"),
        fetch("http://localhost:8000/contests"),
      ]);
      if (probRes.ok) setProblems(await probRes.json());
      if (contestRes.ok) setContests(await contestRes.json());
    } catch {
      // Fallback demo data if backend not yet running
      setProblems([
        { id: "two-sum", title: "Two Sum", difficulty: "Easy", test_cases_count: 2 },
        { id: "reverse-string", title: "Reverse String", difficulty: "Easy", test_cases_count: 2 },
      ]);
      setContests([
        {
          id: "tic-weekly-1",
          title: "TIC Weekly Contest #1",
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          status: "LIVE",
          problem_count: 2,
        },
      ]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateContest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setError("");

    const token = localStorage.getItem("tic_token") || "";

    try {
      const res = await fetch("http://localhost:8000/admin/contests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: contestId.trim(),
          title: contestTitle.trim(),
          description: contestDesc.trim(),
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          problem_ids: selectedProblems,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to schedule contest");
      }

      setMsg(`Contest '${contestTitle}' scheduled successfully.`);
      setContestId("");
      setContestTitle("");
      setContestDesc("");
      setSelectedProblems([]);
      fetchData();
    } catch (err: any) {
      if (err.message?.includes("fetch") || err.message?.includes("connect")) {
        // Local preview simulation
        setMsg(`Contest '${contestTitle}' recorded (demo mode).`);
        setContestId("");
        setContestTitle("");
        setContestDesc("");
      } else {
        setError(err.message || "Failed to create contest");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setError("");

    const test_cases = [];
    if (sampleInput.trim() && sampleOutput.trim()) {
      test_cases.push({
        input: sampleInput.trim(),
        expected_output: sampleOutput.trim(),
        is_hidden: false,
      });
    }
    if (hiddenInput.trim() && hiddenOutput.trim()) {
      test_cases.push({
        input: hiddenInput.trim(),
        expected_output: hiddenOutput.trim(),
        is_hidden: true,
      });
    }

    const token = localStorage.getItem("tic_token") || "";

    try {
      const res = await fetch("http://localhost:8000/admin/problems", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: problemId.trim(),
          title: title.trim(),
          description: description.trim(),
          difficulty,
          test_cases,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to create problem");
      }

      setMsg(`Problem '${title}' added with test cases.`);
      setProblemId("");
      setTitle("");
      setDescription("");
      setSampleInput("");
      setSampleOutput("");
      setHiddenInput("");
      setHiddenOutput("");
      fetchData();
    } catch (err: any) {
      if (err.message?.includes("fetch") || err.message?.includes("connect")) {
        setMsg(`Problem '${title}' added (demo mode).`);
        setProblemId("");
        setTitle("");
        setDescription("");
      } else {
        setError(err.message || "Failed to create problem");
      }
    } finally {
      setLoading(false);
    }
  };

  const openAdminLoginModal = () => {
    window.dispatchEvent(new CustomEvent("open-auth-modal", { detail: { role: "ADMIN" } }));
  };

  // Access Guard: If not logged in as ADMIN
  if (checkedAuth && currentUser?.role !== "ADMIN") {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <Navbar />
        <div className="mx-auto max-w-lg px-6 py-28 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-sm font-mono text-zinc-400 mb-6">
            SEC
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Administrator Access Required
          </h1>
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">
            The contest management room and problem authoring tools are restricted to verified faculty coordinators and club administrators.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={openAdminLoginModal}
              className="rounded-md bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
            >
              Sign In as Admin
            </button>
            <Link
              href="/contests"
              className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
            >
              Return to Contests
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-zinc-100">
      <Navbar />

      <div className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-zinc-800/80">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-0.5 text-[11px] font-mono text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Admin Console · Authorized as {currentUser?.email || "admin@tic.edu"}
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
              Contest & Problem Management
            </h1>
            <p className="mt-1.5 text-xs text-zinc-400">
              Schedule competitive rounds, author problems, and configure automated testsuites.
            </p>
          </div>

          {/* Sub Navigation */}
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-1 text-xs">
            <button
              onClick={() => {
                setActiveTab("contest");
                setMsg("");
                setError("");
              }}
              className={`rounded px-3 py-1.5 font-medium transition ${
                activeTab === "contest"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Host Contest
            </button>
            <button
              onClick={() => {
                setActiveTab("problem");
                setMsg("");
                setError("");
              }}
              className={`rounded px-3 py-1.5 font-medium transition ${
                activeTab === "problem"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Create Problem
            </button>
            <button
              onClick={() => {
                setActiveTab("list");
                setMsg("");
                setError("");
              }}
              className={`rounded px-3 py-1.5 font-medium transition ${
                activeTab === "list"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Repository ({problems.length})
            </button>
          </div>
        </div>

        {/* Feedback alert */}
        {msg && (
          <div className="mt-6 rounded-md border border-emerald-900/40 bg-emerald-950/20 px-4 py-2.5 text-xs text-emerald-400">
            {msg}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-md border border-red-900/40 bg-red-950/20 px-4 py-2.5 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* TAB 1: HOST CONTEST */}
        {activeTab === "contest" && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
              <h2 className="text-sm font-semibold text-zinc-100 mb-1">Schedule Contest Round</h2>
              <p className="text-xs text-zinc-500 mb-6">
                Define the contest window and select problems to include from the repository.
              </p>

              <form onSubmit={handleCreateContest} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Contest Identifier (Slug)
                    </label>
                    <input
                      type="text"
                      required
                      value={contestId}
                      onChange={(e) => setContestId(e.target.value)}
                      placeholder="e.g. tic-weekly-2"
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Contest Title
                    </label>
                    <input
                      type="text"
                      required
                      value={contestTitle}
                      onChange={(e) => setContestTitle(e.target.value)}
                      placeholder="e.g. TIC Weekly Contest #2"
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Description & Rules
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={contestDesc}
                    onChange={(e) => setContestDesc(e.target.value)}
                    placeholder="Solve 3 algorithmic challenges within 90 minutes. Fastest submissions with least attempts rank highest."
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      End Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Problem Selection */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Select Problems Included
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950 p-2.5">
                    {problems.length === 0 ? (
                      <p className="text-xs text-zinc-500 p-2">No problems found. Create problems first.</p>
                    ) : (
                      problems.map((p) => {
                        const isSelected = selectedProblems.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-2.5 p-2 rounded hover:bg-zinc-900 cursor-pointer text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProblems([...selectedProblems, p.id]);
                                } else {
                                  setSelectedProblems(selectedProblems.filter((id) => id !== p.id));
                                }
                              }}
                              className="rounded border-zinc-700 bg-zinc-900 text-zinc-100"
                            />
                            <span className="font-medium text-zinc-200">{p.title}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">({p.difficulty})</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-zinc-100 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition disabled:opacity-50"
                >
                  {loading ? "Scheduling..." : "Publish & Schedule Contest"}
                </button>
              </form>
            </div>

            {/* Sidebar quick info */}
            <div className="space-y-6">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5">
                <h3 className="text-xs font-semibold text-zinc-200">ICPC Scoring Specs</h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  Each contest automatically calculates standings based on:
                </p>
                <ul className="mt-2 text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
                  <li>Total problems solved</li>
                  <li>Elapsed submission minutes</li>
                  <li>20 penalty minutes per rejected run</li>
                </ul>
              </div>

              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5">
                <h3 className="text-xs font-semibold text-zinc-200">Existing Rounds ({contests.length})</h3>
                <div className="mt-3 space-y-2">
                  {contests.slice(0, 3).map((c) => (
                    <div key={c.id} className="text-xs border-b border-zinc-800/60 pb-2 last:border-none">
                      <p className="font-medium text-zinc-300">{c.title}</p>
                      <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                        {new Date(c.startTime).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CREATE PROBLEM */}
        {activeTab === "problem" && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
              <h2 className="text-sm font-semibold text-zinc-100 mb-1">Author Algorithmic Challenge</h2>
              <p className="text-xs text-zinc-500 mb-6">
                Add problem statement, input constraints, and testcase verification pairs.
              </p>

              <form onSubmit={handleCreateProblem} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Problem Slug (ID)
                    </label>
                    <input
                      type="text"
                      required
                      value={problemId}
                      onChange={(e) => setProblemId(e.target.value)}
                      placeholder="e.g. valid-parentheses"
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Difficulty Level
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Problem Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Valid Parentheses"
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Description & Constraints
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid."
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                {/* Sample Test Case */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-zinc-300">Public Sample Case</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Visible to students</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">Input</label>
                      <textarea
                        rows={2}
                        value={sampleInput}
                        onChange={(e) => setSampleInput(e.target.value)}
                        placeholder="()"
                        className="w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-xs font-mono text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">Expected Output</label>
                      <textarea
                        rows={2}
                        value={sampleOutput}
                        onChange={(e) => setSampleOutput(e.target.value)}
                        placeholder="true"
                        className="w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-xs font-mono text-zinc-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Hidden Test Case */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-zinc-300">Hidden Evaluation Case</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Secret testsuite for Judge0</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">Input</label>
                      <textarea
                        rows={2}
                        value={hiddenInput}
                        onChange={(e) => setHiddenInput(e.target.value)}
                        placeholder="()[]{}"
                        className="w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-xs font-mono text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">Expected Output</label>
                      <textarea
                        rows={2}
                        value={hiddenOutput}
                        onChange={(e) => setHiddenOutput(e.target.value)}
                        placeholder="true"
                        className="w-full rounded border border-zinc-800 bg-zinc-900 p-2 text-xs font-mono text-zinc-200"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-zinc-100 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition disabled:opacity-50"
                >
                  {loading ? "Adding Problem..." : "Save Problem to Repository"}
                </button>
              </form>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5">
                <h3 className="text-xs font-semibold text-zinc-200">Evaluation Specs</h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  Submissions are graded using whitespace-normalized token comparison against each testcase.
                </p>
                <div className="mt-4 text-[11px] font-mono text-zinc-400 space-y-1">
                  <p>Python 3.8.1 (Judge0 #71)</p>
                  <p>C++ GCC 9.2.0 (Judge0 #54)</p>
                  <p>Java 13 (Judge0 #62)</p>
                  <p>Node.js 12 (Judge0 #63)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: OVERVIEW REPOSITORY */}
        {activeTab === "list" && (
          <div className="mt-8 rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Repository Problems</h3>
                <p className="text-xs text-zinc-500">All questions configured for contest usage.</p>
              </div>
              <button
                onClick={() => setActiveTab("problem")}
                className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-zinc-200 transition"
              >
                + New Problem
              </button>
            </div>

            <div className="divide-y divide-zinc-800/60">
              {problems.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-zinc-900/60 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-zinc-200">{p.title}</span>
                      <span className="text-[10px] font-mono text-zinc-400">({p.id})</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{p.description}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        p.difficulty === "Easy"
                          ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/40"
                          : p.difficulty === "Medium"
                          ? "bg-amber-950/30 text-amber-400 border-amber-900/40"
                          : "bg-red-950/30 text-red-400 border-red-900/40"
                      }`}
                    >
                      {p.difficulty}
                    </span>
                    <Link
                      href={`/problems/${p.id}`}
                      className="text-xs text-zinc-400 hover:text-zinc-200 transition"
                    >
                      Preview →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

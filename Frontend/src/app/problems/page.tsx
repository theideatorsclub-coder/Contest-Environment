"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import { API_BASE_URL } from "@/lib/api";

interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  test_cases_count?: number;
}

const DEFAULT_PROBLEMS: Problem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    difficulty: "Easy",
    test_cases_count: 2,
  },
  {
    id: "reverse-string",
    title: "Reverse String",
    description: "Write a program that takes a string from standard input and prints the reversed string to standard output.",
    difficulty: "Easy",
    test_cases_count: 2,
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    description: "Given a string s containing just characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
    difficulty: "Medium",
    test_cases_count: 3,
  },
];

export default function ProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>(DEFAULT_PROBLEMS);
  const [search, setSearch] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("ALL");
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = () => {
      const stored = localStorage.getItem("tic_user");
      if (stored) {
        try {
          const u = JSON.parse(stored);
          setUserRole(u.role || "");
        } catch {
          setUserRole("");
        }
      }
    };

    checkRole();
    window.addEventListener("auth-change", checkRole);
    return () => window.removeEventListener("auth-change", checkRole);
  }, []);

  useEffect(() => {
    async function fetchProblems() {
      try {
        const res = await fetch(`${API_BASE_URL}/problems`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setProblems(data);
          }
        }
      } catch {
        // Fallback default
      } finally {
        setLoading(false);
      }
    }
    fetchProblems();
  }, []);

  const filtered = problems.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    const matchesDiff = filterDifficulty === "ALL" || p.difficulty.toUpperCase() === filterDifficulty;
    return matchesSearch && matchesDiff;
  });

  return (
    <AuthGuard>
      <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-zinc-100">
        <Navbar />

      <div className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-zinc-800/80">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-0.5 text-[11px] font-mono text-zinc-400">
              Repository
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
              Practice Problems
            </h1>
            <p className="mt-1.5 text-xs text-zinc-400 max-w-xl leading-relaxed">
              Sharpen your algorithmic thinking. Test solutions with automated testcases on the Judge0 engine.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {userRole === "ADMIN" && (
              <Link
                href="/admin"
                className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
              >
                + Create Problem
              </Link>
            )}
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by problem title or identifier..."
              className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {["ALL", "EASY", "MEDIUM", "HARD"].map((diff) => (
              <button
                key={diff}
                onClick={() => setFilterDifficulty(diff)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                  filterDifficulty === diff
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {diff.charAt(0) + diff.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Problems Table */}
        <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 border-b border-zinc-800/80 px-6 py-3 text-[11px] font-mono uppercase text-zinc-500">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-6 md:col-span-7">Title</div>
            <div className="col-span-2">Difficulty</div>
            <div className="col-span-3 text-right">Action</div>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {filtered.length > 0 ? (
              filtered.map((p, idx) => (
                <div
                  key={p.id}
                  className="grid grid-cols-12 items-center gap-4 px-6 py-3.5 text-xs hover:bg-zinc-900/40 transition"
                >
                  <div className="col-span-1 text-center font-mono text-zinc-500">
                    {idx + 1}
                  </div>
                  <div className="col-span-6 md:col-span-7">
                    <Link
                      href={`/problems/${p.id}`}
                      className="font-medium text-zinc-200 hover:text-zinc-100 transition"
                    >
                      {p.title}
                    </Link>
                    <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                      {p.description}
                    </p>
                  </div>
                  <div className="col-span-2">
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
                  </div>
                  <div className="col-span-3 text-right">
                    <Link
                      href={`/problems/${p.id}`}
                      className="inline-flex rounded bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
                    >
                      Solve →
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-zinc-500">
                No matching problems found.
              </div>
            )}
          </div>
        </div>
      </div>
      </main>
    </AuthGuard>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import { apiFetchSafe, getCurrentUser } from "@/lib/api";
import type { Problem } from "@/lib/types";

export default function ProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("ALL");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const checkRole = () => setUserRole(getCurrentUser()?.role || "");
    checkRole();
    window.addEventListener("auth-change", checkRole);
    return () => window.removeEventListener("auth-change", checkRole);
  }, []);

  useEffect(() => {
    async function load() {
      const data = await apiFetchSafe<Problem[]>("/problems");
      if (data) setProblems(data);
      else setError("Could not load problems. Make sure the backend is running.");
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = problems;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
      );
    }
    if (filterDifficulty !== "ALL") {
      result = result.filter((p) => (p.difficulty || "").toUpperCase() === filterDifficulty);
    }
    return result;
  }, [problems, search, filterDifficulty]);

  return (
    <AuthGuard>
      <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-zinc-100">
        <Navbar />

        <div className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-zinc-800/80">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-0.5 text-[11px] font-mono text-zinc-400">
                Repository
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">Practice Problems</h1>
              <p className="mt-1.5 text-xs text-zinc-400 max-w-xl leading-relaxed">
                Sharpen your algorithmic thinking. Test solutions with automated testcases on the Judge0 engine.
              </p>
            </div>
            {userRole === "ADMIN" && (
              <Link href="/admin/problems/new" className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition">
                + Create Problem
              </Link>
            )}
          </div>

          {error && (
            <div className="mt-6 rounded-md border border-amber-900/40 bg-amber-950/20 px-4 py-2.5 text-xs text-amber-400">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by problem title or identifier..."
              className="flex-1 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
            />
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              {["ALL", "EASY", "MEDIUM", "HARD"].map((diff) => (
                <button
                  key={diff}
                  onClick={() => setFilterDifficulty(diff)}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                    filterDifficulty === diff ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {diff.charAt(0) + diff.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-zinc-400" />
                <p className="text-xs text-zinc-500 font-mono">Loading problems…</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-20 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-sm text-zinc-500">∅</div>
              <h3 className="mt-4 text-sm font-medium text-zinc-300">No problems found</h3>
              <p className="mt-1.5 text-xs text-zinc-500">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
              <div className="grid grid-cols-12 gap-4 border-b border-zinc-800/80 px-6 py-3 text-[11px] font-mono uppercase text-zinc-500">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-6 md:col-span-7">Title</div>
                <div className="col-span-2">Difficulty</div>
                <div className="col-span-3 text-right">Action</div>
              </div>
              <div className="divide-y divide-zinc-800/60">
                {filtered.map((p, idx) => (
                  <div key={p.id} className="grid grid-cols-12 items-center gap-4 px-6 py-3.5 text-xs hover:bg-zinc-900/40 transition">
                    <div className="col-span-1 text-center font-mono text-zinc-500">{idx + 1}</div>
                    <div className="col-span-6 md:col-span-7">
                      <Link href={`/problems/${p.id}`} className="font-medium text-zinc-200 hover:text-zinc-100 transition">
                        {p.title}
                      </Link>
                      <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{p.description}</p>
                    </div>
                    <div className="col-span-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        p.difficulty === "Easy" ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/40"
                        : p.difficulty === "Medium" ? "bg-amber-950/30 text-amber-400 border-amber-900/40"
                        : "bg-red-950/30 text-red-400 border-red-900/40"
                      }`}>
                        {p.difficulty}
                      </span>
                    </div>
                    <div className="col-span-3 text-right">
                      <Link href={`/problems/${p.id}`} className="inline-flex rounded bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition">
                        Solve →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </AuthGuard>
  );
}

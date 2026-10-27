"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import { apiFetchSafe, getCurrentUser } from "@/lib/api";
import type { Contest } from "@/lib/types";

export default function ContestsPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const checkRole = () => setUserRole(getCurrentUser()?.role || "");
    checkRole();
    window.addEventListener("auth-change", checkRole);
    return () => window.removeEventListener("auth-change", checkRole);
  }, []);

  useEffect(() => {
    async function load() {
      const data = await apiFetchSafe<Contest[]>("/contests");
      if (data) setContests(data);
      else setError("Could not load contests. Make sure the backend is running.");
      setLoading(false);
    }
    load();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "LIVE":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/40 bg-emerald-950/20 px-2.5 py-0.5 text-[10px] font-mono text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Round
          </span>
        );
      case "UPCOMING":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-0.5 text-[10px] font-mono text-zinc-400">
            Upcoming
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-900 bg-zinc-950 px-2.5 py-0.5 text-[10px] font-mono text-zinc-600">
            Concluded
          </span>
        );
    }
  };

  return (
    <AuthGuard>
      <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-zinc-100">
        <Navbar />

        <div className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-zinc-800/80">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-0.5 text-[11px] font-mono text-zinc-400">
                Contest Arena
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
                Synchronized Contests
              </h1>
              <p className="mt-1.5 text-xs text-zinc-400 max-w-xl leading-relaxed">
                Timed coding challenges for college students. Submissions judged against test suites with live ICPC standings.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/problems" className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition">
                Practice Bank
              </Link>
              {userRole === "ADMIN" && (
                <Link href="/admin" className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition">
                  + Schedule Contest
                </Link>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-md border border-amber-900/40 bg-amber-950/20 px-4 py-2.5 text-xs text-amber-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-zinc-400" />
                <p className="text-xs text-zinc-500 font-mono">Loading contests…</p>
              </div>
            </div>
          ) : contests.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-20 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-sm text-zinc-500">∅</div>
              <h3 className="mt-4 text-sm font-medium text-zinc-300">No contests scheduled</h3>
              <p className="mt-1.5 text-xs text-zinc-500">Check back soon for upcoming rounds.</p>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {contests.map((c) => (
                <div key={c.id} className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6 transition hover:border-zinc-700">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-zinc-800/60">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-base font-semibold text-zinc-100">{c.title}</h2>
                        {getStatusBadge(c.status)}
                      </div>
                      <p className="mt-2 text-xs text-zinc-400 max-w-2xl leading-relaxed">{c.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/contests/${c.id}`} className="rounded-md bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition">
                        Enter Arena →
                      </Link>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500 font-mono">
                    <div>
                      <span>Round: </span>
                      <span className="text-zinc-400">{new Date(c.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {new Date(c.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div><span>Date: </span><span className="text-zinc-400">{new Date(c.startTime).toLocaleDateString()}</span></div>
                    <div><span>Problems: </span><span className="text-zinc-400">{c.problem_count}</span></div>
                    <div><span>Scoring: </span><span className="text-zinc-400">ACM ICPC (+20m)</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </AuthGuard>
  );
}

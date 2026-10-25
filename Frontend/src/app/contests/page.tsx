"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
<<<<<<< HEAD
=======
import { API_BASE_URL } from "@/lib/api";
>>>>>>> vaidehi-local

interface Contest {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  status: "UPCOMING" | "LIVE" | "ENDED";
  problem_count: number;
}

const DEFAULT_CONTESTS: Contest[] = [
  {
    id: "tic-weekly-1",
    title: "TIC Weekly Contest #1",
    description: "Weekly algorithmic round organized by The Ideators Club. Solve 3 problems within 90 minutes.",
    startTime: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    endTime: new Date(Date.now() + 1000 * 60 * 70).toISOString(),
    status: "LIVE",
    problem_count: 2,
  },
  {
    id: "campus-hack-rush",
    title: "Campus Speedrun Round",
    description: "Rapid algorithmic challenge testing optimization, edge cases, and runtime efficiency.",
    startTime: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 50).toISOString(),
    status: "UPCOMING",
    problem_count: 3,
  },
];

export default function ContestsPage() {
  const [contests, setContests] = useState<Contest[]>(DEFAULT_CONTESTS);
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
    async function fetchContests() {
      try {
<<<<<<< HEAD
        const res = await fetch("http://localhost:8000/contests", { cache: "no-store" });
=======
        const res = await fetch(`${API_BASE_URL}/contests`, { cache: "no-store" });
>>>>>>> vaidehi-local
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setContests(data);
          }
        }
      } catch {
        // use default fallback
      } finally {
        setLoading(false);
      }
    }
    fetchContests();
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
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-zinc-800/80">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-0.5 text-[11px] font-mono text-zinc-400">
              Contest Arena
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
              Synchronized Contests
            </h1>
            <p className="mt-1.5 text-xs text-zinc-400 max-w-xl leading-relaxed">
              Timed coding challenges for college students. Submissions are judged against test suites with live ICPC score updates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/problems"
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
            >
              Practice Bank
            </Link>
            {userRole === "ADMIN" && (
              <Link
                href="/admin"
                className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
              >
                + Schedule Contest
              </Link>
            )}
          </div>
        </div>

        {/* Contest Cards */}
        <div className="mt-8 space-y-4">
          {contests.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6 transition hover:border-zinc-700"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-zinc-800/60">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-semibold text-zinc-100">
                      {c.title}
                    </h2>
                    {getStatusBadge(c.status)}
                  </div>
                  <p className="mt-2 text-xs text-zinc-400 max-w-2xl leading-relaxed">
                    {c.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/contests/${c.id}`}
                    className="rounded-md bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
                  >
                    Enter Arena →
                  </Link>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500 font-mono">
                <div>
                  <span>Round Window: </span>
                  <span className="text-zinc-400">
                    {new Date(c.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" — "}
                    {new Date(c.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div>
                  <span>Date: </span>
                  <span className="text-zinc-400">{new Date(c.startTime).toLocaleDateString()}</span>
                </div>
                <div>
                  <span>Problems: </span>
                  <span className="text-zinc-400">{c.problem_count || 3}</span>
                </div>
                <div>
                  <span>Scoring: </span>
                  <span className="text-zinc-400">ACM ICPC (+20m penalty)</span>
                </div>
              </div>
            </div>
          ))}
        </div>
<<<<<<< HEAD
=======
      </div>
>>>>>>> vaidehi-local
      </main>
    </AuthGuard>
  );
}

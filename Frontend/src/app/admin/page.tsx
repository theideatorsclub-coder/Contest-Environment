"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetchSafe, getCurrentUser, API_BASE_URL } from "@/lib/api";
import type { Contest, Problem, LeaderboardUser, UserPayload } from "@/lib/types";
import { StatCard, LoadingSpinner, StatusBadge, DifficultyBadge } from "@/components/admin/AdminUI";

export default function AdminDashboardPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserPayload | null>(null);
  const [error, setError] = useState("");
  const [totalSubmissions, setTotalSubmissions] = useState<number | null>(null);
  const [acceptanceRate, setAcceptanceRate] = useState<number | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  useEffect(() => {
    async function loadAll() {
      const [contestData, problemData, lbData, overviewData] = await Promise.all([
        apiFetchSafe<Contest[]>("/contests"),
        apiFetchSafe<Problem[]>("/problems"),
        apiFetchSafe<{ leaderboard: LeaderboardUser[] }>("/leaderboard"),
        apiFetchSafe<{ total_submissions: number; accepted_submissions: number; acceptance_rate: number }>("/admin/analytics/overview"),
      ]);

      if (contestData) setContests(contestData);
      if (problemData) setProblems(problemData);
      if (lbData?.leaderboard) setLeaderboard(lbData.leaderboard);
      if (overviewData) {
        setTotalSubmissions(overviewData.total_submissions);
        setAcceptanceRate(overviewData.acceptance_rate);
      }

      if (!contestData && !problemData) {
        setError("Backend not reachable. Ensure the API server is running at " + API_BASE_URL);
      }
      setLoading(false);
    }
    loadAll();
  }, []);

  const liveCount = contests.filter((c) => c.status === "LIVE").length;
  const upcomingCount = contests.filter((c) => c.status === "UPCOMING").length;
  const endedCount = contests.filter((c) => c.status === "ENDED").length;
  const participantCount = leaderboard.length;

  if (loading) return <LoadingSpinner label="Loading dashboard..." />;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-0.5 text-[11px] font-mono text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Admin Console · {user?.email || "admin@tic.edu"}
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100">
          Dashboard Overview
        </h1>
        <p className="mt-1.5 text-xs text-zinc-400">
          Platform statistics and quick access to management tools.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-900/40 bg-red-950/20 px-4 py-2.5 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Contests" value={contests.length} icon="🏆" accent="zinc" />
        <StatCard label="Live Contests" value={liveCount} icon="●" accent="emerald" />
        <StatCard label="Upcoming" value={upcomingCount} icon="📅" accent="blue" />
        <StatCard label="Completed" value={endedCount} icon="✓" accent="zinc" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Participants" value={participantCount} icon="👥" accent="blue" />
        <StatCard label="Problems" value={problems.length} icon="📋" accent="zinc" />
        <StatCard label="Submissions" value={totalSubmissions ?? "—"} icon="📨" accent="amber" />
        {acceptanceRate !== null && (
          <StatCard label="Acceptance Rate" value={`${acceptanceRate}%`} icon="✓" accent="emerald" />
        )}
        <StatCard label="Test Cases" value={problems.reduce((sum, p) => sum + (p.test_cases_count || 0), 0)} icon="🧪" accent="zinc" />
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          href="/admin/contests"
          className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-200">Manage Contests</span>
            <span className="text-zinc-600 transition group-hover:text-zinc-400">→</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Schedule, edit, and manage contest rounds</p>
        </Link>

        <Link
          href="/admin/problems"
          className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-200">Question Bank</span>
            <span className="text-zinc-600 transition group-hover:text-zinc-400">→</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Create, edit, and organize problems</p>
        </Link>

        <Link
          href="/admin/participants"
          className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-200">Participants</span>
            <span className="text-zinc-600 transition group-hover:text-zinc-400">→</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">View and manage student accounts</p>
        </Link>
      </div>

      {/* Recent Contests */}
      <div className="mt-8 rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
        <div className="border-b border-zinc-800 p-5">
          <h3 className="text-sm font-semibold text-zinc-100">Recent Contests</h3>
          <p className="text-xs text-zinc-500">Latest contest activity</p>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {contests.length > 0 ? (
            contests.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between p-4 hover:bg-zinc-900/40 transition">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs font-medium text-zinc-200">{c.title}</p>
                    <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      {new Date(c.startTime).toLocaleDateString()} · {c.problem_count} problems
                    </p>
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-zinc-500">
              No contests found. <Link href="/admin/contests" className="text-zinc-300 underline">Create one →</Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent Problems & Top Participants */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Problems */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
          <div className="border-b border-zinc-800 p-5">
            <h3 className="text-sm font-semibold text-zinc-100">Recent Problems</h3>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {problems.length > 0 ? (
              problems.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 hover:bg-zinc-900/40 transition">
                  <div>
                    <p className="text-xs font-medium text-zinc-200">{p.title}</p>
                    <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{p.id} · {p.test_cases_count || 0} tests</p>
                  </div>
                  <DifficultyBadge difficulty={p.difficulty} />
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-zinc-500">No problems found.</div>
            )}
          </div>
        </div>

        {/* Top Participants */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
          <div className="border-b border-zinc-800 p-5">
            <h3 className="text-sm font-semibold text-zinc-100">Top Participants</h3>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {leaderboard.length > 0 ? (
              leaderboard.slice(0, 5).map((u) => (
                <div key={u.userId} className="flex items-center justify-between p-4 hover:bg-zinc-900/40 transition">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-zinc-500">#{u.rank}</span>
                    <span className="text-xs font-medium text-zinc-200">{u.username}</span>
                  </div>
                  <span className="text-xs font-mono text-zinc-400">{u.accepted_count} solved</span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-zinc-500">No participants ranked yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Problems & Top Participants */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Problems */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
          <div className="border-b border-zinc-800 p-5">
            <h3 className="text-sm font-semibold text-zinc-100">Recent Problems</h3>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {problems.length > 0 ? (
              problems.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 hover:bg-zinc-900/40 transition">
                  <div>
                    <p className="text-xs font-medium text-zinc-200">{p.title}</p>
                    <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{p.id} · {p.test_cases_count || 0} tests</p>
                  </div>
                  <DifficultyBadge difficulty={p.difficulty} />
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-zinc-500">No problems found.</div>
            )}
          </div>
        </div>

        {/* Top Participants */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
          <div className="border-b border-zinc-800 p-5">
            <h3 className="text-sm font-semibold text-zinc-100">Top Participants</h3>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {leaderboard.length > 0 ? (
              leaderboard.slice(0, 5).map((u) => (
                <div key={u.userId} className="flex items-center justify-between p-4 hover:bg-zinc-900/40 transition">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-zinc-500">#{u.rank}</span>
                    <span className="text-xs font-medium text-zinc-200">{u.username}</span>
                  </div>
                  <span className="text-xs font-mono text-zinc-400">{u.accepted_count} solved</span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-zinc-500">No participants ranked yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

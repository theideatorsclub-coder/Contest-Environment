"use client";

import { useEffect, useState } from "react";
import { apiFetchSafe, getAuthToken } from "@/lib/api";
import type { Contest, Problem, LeaderboardUser } from "@/lib/types";
import { LoadingSpinner, StatCard, EmptyState } from "@/components/admin/AdminUI";

// ---- Types for new analytics endpoints ----
interface OverviewStats {
  total_submissions: number;
  accepted_submissions: number;
  acceptance_rate: number;
  total_problems: number;
  total_contests: number;
  total_students: number;
}

interface ProblemStat {
  id: string;
  title: string;
  difficulty: string;
  total_attempts: number;
  accepted_count: number;
  acceptance_rate: number;
}

interface ParticipationStat {
  id: string;
  title: string;
  status: string;
  startTime: string;
  problem_count: number;
  unique_participants: number;
  total_submissions: number;
  accepted_submissions: number;
}

export default function AdminAnalyticsPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [problemStats, setProblemStats] = useState<ProblemStat[]>([]);
  const [participation, setParticipation] = useState<ParticipationStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [cData, pData, lbData, ovData, psData, partData] = await Promise.all([
        apiFetchSafe<Contest[]>("/contests"),
        apiFetchSafe<Problem[]>("/problems"),
        apiFetchSafe<{ leaderboard: LeaderboardUser[] }>("/leaderboard"),
        apiFetchSafe<OverviewStats>("/admin/analytics/overview"),
        apiFetchSafe<ProblemStat[]>("/admin/analytics/problems"),
        apiFetchSafe<ParticipationStat[]>("/admin/analytics/participation"),
      ]);
      if (cData) setContests(cData);
      if (pData) setProblems(pData);
      if (lbData?.leaderboard) setLeaderboard(lbData.leaderboard);
      if (ovData) setOverview(ovData);
      if (psData) setProblemStats(psData);
      if (partData) setParticipation(partData);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Loading analytics..." />;

  // ---- Derived data ----
  const liveCount = contests.filter((c) => c.status === "LIVE").length;
  const upcomingCount = contests.filter((c) => c.status === "UPCOMING").length;
  const endedCount = contests.filter((c) => c.status === "ENDED").length;
  const totalTC = problems.reduce((s, p) => s + (p.test_cases_count || 0), 0);

  const easyCount = problems.filter((p) => p.difficulty === "Easy").length;
  const medCount = problems.filter((p) => p.difficulty === "Medium").length;
  const hardCount = problems.filter((p) => p.difficulty === "Hard").length;
  const maxDiff = Math.max(easyCount, medCount, hardCount, 1);

  const sortedTimeline = [...contests].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const top5 = leaderboard.slice(0, 5);
  const maxAccepted = top5.length ? top5[0].accepted_count : 1;

  const maxAttempts = problemStats.length ? problemStats[0].total_attempts : 1;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Analytics</h1>
        <p className="mt-1.5 text-xs text-zinc-400">Platform performance and contest insights.</p>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Contests" value={overview?.total_contests ?? contests.length} icon="🏆" accent="zinc" />
        <StatCard label="Total Problems" value={overview?.total_problems ?? problems.length} icon="📋" accent="zinc" />
        <StatCard label="Participants" value={overview?.total_students ?? leaderboard.length} icon="👥" accent="blue" />
        <StatCard label="Test Cases" value={totalTC} icon="🧪" accent="zinc" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Submissions" value={overview?.total_submissions ?? "—"} icon="📨" accent="amber" />
        <StatCard label="Accepted" value={overview?.accepted_submissions ?? "—"} icon="✓" accent="emerald" />
        <StatCard label="Acceptance Rate" value={overview ? `${overview.acceptance_rate}%` : "—"} icon="📊" accent="blue" />
        <StatCard label="Live Now" value={liveCount} icon="●" accent="emerald" />
      </div>

      {/* Contest status distribution */}
      <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
        <h3 className="text-sm font-semibold text-zinc-100">Contest Status Distribution</h3>
        <div className="mt-4 space-y-3">
          {[
            { label: "Live", count: liveCount, color: "bg-emerald-500" },
            { label: "Upcoming", count: upcomingCount, color: "bg-blue-500" },
            { label: "Completed", count: endedCount, color: "bg-zinc-500" },
          ].map((s) => (
            <div key={s.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300">{s.label}</span>
                <span className="font-mono text-zinc-400">{s.count}</span>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-full bg-zinc-800">
                <div className={`h-full rounded-full ${s.color}`} style={{ width: `${(s.count / Math.max(contests.length, 1)) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column: Problem difficulty + Overview stats */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
          <h3 className="text-sm font-semibold text-zinc-100">Problem Difficulty Distribution</h3>
          <div className="mt-4 space-y-3">
            {[
              { label: "Easy", count: easyCount, color: "bg-emerald-500" },
              { label: "Medium", count: medCount, color: "bg-amber-500" },
              { label: "Hard", count: hardCount, color: "bg-red-500" },
            ].map((d) => (
              <div key={d.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">{d.label}</span>
                  <span className="font-mono text-zinc-400">{d.count}</span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-zinc-800">
                  <div className={`h-full rounded-full ${d.color}`} style={{ width: `${(d.count / maxDiff) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
          <h3 className="text-sm font-semibold text-zinc-100">Platform Summary</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-center">
              <p className="text-[10px] font-mono uppercase text-zinc-500">Total Submissions</p>
              <p className="mt-1 text-xl font-bold font-mono text-zinc-100">{overview?.total_submissions ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-center">
              <p className="text-[10px] font-mono uppercase text-zinc-500">Accepted</p>
              <p className="mt-1 text-xl font-bold font-mono text-emerald-400">{overview?.accepted_submissions ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-center">
              <p className="text-[10px] font-mono uppercase text-zinc-500">Acceptance Rate</p>
              <p className="mt-1 text-xl font-bold font-mono text-zinc-100">{overview ? `${overview.acceptance_rate}%` : "—"}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-center">
              <p className="text-[10px] font-mono uppercase text-zinc-500">Students</p>
              <p className="mt-1 text-xl font-bold font-mono text-zinc-100">{overview?.total_students ?? "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Per-problem stats */}
      {problemStats.length > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
          <h3 className="text-sm font-semibold text-zinc-100">Problem Attempt Stats</h3>
          <p className="text-xs text-zinc-500 mt-1">Most attempted problems</p>
          <div className="mt-4 space-y-3">
            {problemStats.slice(0, 6).map((p) => {
              const pct = (p.total_attempts / maxAttempts) * 100;
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 truncate">{p.title}</span>
                    <span className="font-mono text-zinc-400 ml-2 shrink-0">
                      {p.total_attempts} attempts · {p.accepted_count} solved ({p.acceptance_rate}%)
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contest participation */}
      {participation.length > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
          <div className="border-b border-zinc-800 p-5">
            <h3 className="text-sm font-semibold text-zinc-100">Contest Participation</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Unique participants and submissions per contest</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-500">
                  <th className="px-5 py-3 text-left">Contest</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-center">Problems</th>
                  <th className="px-5 py-3 text-center">Participants</th>
                  <th className="px-5 py-3 text-center">Submissions</th>
                  <th className="px-5 py-3 text-center">Accepted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {participation.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-900/40 transition">
                    <td className="px-5 py-3 text-zinc-200 font-medium truncate max-w-[180px]">{c.title}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase ${
                        c.status === "LIVE" ? "bg-emerald-950/30 text-emerald-400"
                        : c.status === "UPCOMING" ? "bg-blue-950/30 text-blue-400"
                        : "bg-zinc-900 text-zinc-500"
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-5 py-3 text-center font-mono text-zinc-400">{c.problem_count}</td>
                    <td className="px-5 py-3 text-center font-mono text-zinc-300">{c.unique_participants}</td>
                    <td className="px-5 py-3 text-center font-mono text-zinc-400">{c.total_submissions}</td>
                    <td className="px-5 py-3 text-center font-mono text-emerald-400">{c.accepted_submissions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contest timeline */}
      {sortedTimeline.length > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
          <h3 className="text-sm font-semibold text-zinc-100">Contest Timeline</h3>
          <div className="mt-4 space-y-2">
            {sortedTimeline.map((c) => (
              <div key={c.id} className="flex items-center gap-4 text-xs">
                <span className="font-mono text-zinc-500 w-28 shrink-0">{new Date(c.startTime).toLocaleDateString()}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-200 font-medium truncate">{c.title}</span>
                  </div>
                </div>
                <span className="font-mono text-zinc-400 shrink-0">{c.problem_count} problems</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top performers */}
      {top5.length > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
          <h3 className="text-sm font-semibold text-zinc-100">Top 5 Performers</h3>
          <p className="text-xs text-zinc-500 mt-1">By accepted submissions</p>
          <div className="mt-4 space-y-3">
            {top5.map((u) => {
              const pct = (u.accepted_count / maxAccepted) * 100;
              return (
                <div key={u.userId}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">
                      <span className="font-mono text-zinc-500 mr-2">#{u.rank}</span>
                      {u.username}
                    </span>
                    <span className="font-mono text-zinc-400">{u.accepted_count}</span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-zinc-600 to-zinc-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {contests.length === 0 && problems.length === 0 && (
        <div className="mt-6"><EmptyState title="No data yet" description="Create contests and problems to see analytics." /></div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { apiFetchSafe } from "@/lib/api";
import type { Contest, Problem, LeaderboardUser } from "@/lib/types";
import { LoadingSpinner, StatCard } from "@/components/admin/AdminUI";

export default function AdminAnalyticsPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [cData, pData, lbData] = await Promise.all([
        apiFetchSafe<Contest[]>("/contests"),
        apiFetchSafe<Problem[]>("/problems"),
        apiFetchSafe<{ leaderboard: LeaderboardUser[] }>("/leaderboard"),
      ]);
      if (cData) setContests(cData);
      if (pData) setProblems(pData);
      if (lbData?.leaderboard) setLeaderboard(lbData.leaderboard);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Loading analytics..." />;

  // Derived stats from available data
  const liveCount = contests.filter((c) => c.status === "LIVE").length;
  const upcomingCount = contests.filter((c) => c.status === "UPCOMING").length;
  const endedCount = contests.filter((c) => c.status === "ENDED").length;

  const easyCount = problems.filter((p) => (p.difficulty || "").toLowerCase() === "easy").length;
  const mediumCount = problems.filter((p) => (p.difficulty || "").toLowerCase() === "medium").length;
  const hardCount = problems.filter((p) => (p.difficulty || "").toLowerCase() === "hard").length;

  // Contest timeline data (for a simple bar chart)
  const contestTimeline = [...contests].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // Leaderboard distribution
  const top5 = leaderboard.slice(0, 5);
  const maxAccepted = top5.length > 0 ? top5[0].accepted_count : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Analytics</h1>
        <p className="mt-1.5 text-xs text-zinc-400">Platform-wide statistics and trends.</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Contests" value={contests.length} icon="🏆" accent="zinc" />
        <StatCard label="Total Problems" value={problems.length} icon="📋" accent="blue" />
        <StatCard label="Participants" value={leaderboard.length} icon="👥" accent="emerald" />
        <StatCard label="Test Cases" value={problems.reduce((s, p) => s + (p.test_cases_count || 0), 0)} icon="🧪" accent="amber" />
      </div>

      {/* Contest Status Distribution */}
      <div className="mt-8 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
        <h3 className="text-sm font-semibold text-zinc-100">Contest Status Distribution</h3>
        <div className="mt-4 space-y-3">
          {[
            { label: "Live", count: liveCount, color: "bg-emerald-500" },
            { label: "Upcoming", count: upcomingCount, color: "bg-blue-500" },
            { label: "Completed", count: endedCount, color: "bg-zinc-500" },
          ].map((item) => {
            const pct = contests.length > 0 ? (item.count / contests.length) * 100 : 0;
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">{item.label}</span>
                  <span className="font-mono text-zinc-300">{item.count} ({pct.toFixed(0)}%)</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Problem Difficulty Distribution */}
      <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
        <h3 className="text-sm font-semibold text-zinc-100">Problem Difficulty Distribution</h3>
        <div className="mt-4 space-y-3">
          {[
            { label: "Easy", count: easyCount, color: "bg-emerald-500" },
            { label: "Medium", count: mediumCount, color: "bg-amber-500" },
            { label: "Hard", count: hardCount, color: "bg-red-500" },
          ].map((item) => {
            const pct = problems.length > 0 ? (item.count / problems.length) * 100 : 0;
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">{item.label}</span>
                  <span className="font-mono text-zinc-300">{item.count} ({pct.toFixed(0)}%)</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Contest Timeline */}
      <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
        <h3 className="text-sm font-semibold text-zinc-100">Contest Timeline</h3>
        <p className="text-xs text-zinc-500 mt-1">Contest schedule overview</p>
        <div className="mt-4 space-y-2">
          {contestTimeline.length > 0 ? (
            contestTimeline.map((c) => (
              <div key={c.id} className="flex items-center gap-4 text-xs">
                <span className="font-mono text-zinc-500 w-28 shrink-0">{new Date(c.startTime).toLocaleDateString()}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-200 font-medium truncate">{c.title}</span>
                  </div>
                </div>
                <span className="font-mono text-zinc-400 shrink-0">{c.problem_count} problems</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-zinc-500">No contests available.</p>
          )}
        </div>
      </div>

      {/* Top Performers Bar Chart */}
      {top5.length > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
          <h3 className="text-sm font-semibold text-zinc-100">Top 5 Performers</h3>
          <p className="text-xs text-zinc-500 mt-1">By accepted submissions</p>
          <div className="mt-4 space-y-3">
            {top5.map((u) => {
              const pct = maxAccepted > 0 ? (u.accepted_count / maxAccepted) * 100 : 0;
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

      {/* Missing Backend Endpoints Note */}
      <div className="mt-8 rounded-xl border border-amber-900/40 bg-amber-950/10 p-6">
        <h3 className="text-sm font-semibold text-amber-400">Missing Backend Endpoints for Full Analytics</h3>
        <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
          The following backend endpoints are needed for complete analytics. Charts above use only data from existing endpoints (/contests, /problems, /leaderboard).
        </p>
        <ul className="mt-3 space-y-1.5 text-xs text-zinc-500">
          <li><span className="font-mono text-zinc-400">GET /admin/submissions</span> — List all submissions for submission/acceptance trends</li>
          <li><span className="font-mono text-zinc-400">GET /admin/analytics/overview</span> — Aggregated platform stats (total submissions, acceptance rate)</li>
          <li><span className="font-mono text-zinc-400">GET /admin/analytics/problems</span> — Per-problem attempt/solve counts (most attempted, most solved)</li>
          <li><span className="font-mono text-zinc-400">GET /admin/analytics/participation</span> — Per-contest participation trends over time</li>
        </ul>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetchSafe } from "@/lib/api";
import type { Contest, ContestLeaderboard, LeaderboardUser } from "@/lib/types";
import { LoadingSpinner, EmptyState, StatusBadge } from "@/components/admin/AdminUI";

export default function AdminResultsPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContestId, setSelectedContestId] = useState<string>("");
  const [contestLeaderboard, setContestLeaderboard] = useState<ContestLeaderboard | null>(null);
  const [lbLoading, setLbLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [cData, lbData] = await Promise.all([
        apiFetchSafe<Contest[]>("/contests"),
        apiFetchSafe<{ leaderboard: LeaderboardUser[] }>("/leaderboard"),
      ]);
      if (cData) {
        setContests(cData);
        // Auto-select latest contest
        const ended = cData.filter((c) => c.status === "ENDED");
        if (ended.length > 0) setSelectedContestId(ended[0].id);
        else if (cData.length > 0) setSelectedContestId(cData[0].id);
      }
      if (lbData?.leaderboard) setGlobalLeaderboard(lbData.leaderboard);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    async function loadContestLB() {
      if (!selectedContestId) return;
      setLbLoading(true);
      const data = await apiFetchSafe<ContestLeaderboard>(`/contests/${selectedContestId}/leaderboard`);
      if (data) setContestLeaderboard(data);
      else setContestLeaderboard(null);
      setLbLoading(false);
    }
    loadContestLB();
  }, [selectedContestId]);

  function exportGlobalCSV() {
    const headers = ["Rank", "Username", "User ID", "Accepted Count"];
    const rows = globalLeaderboard.map((u) => [u.rank, u.username, u.userId, u.accepted_count].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tic-global-leaderboard.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportContestCSV() {
    if (!contestLeaderboard || contestLeaderboard.standings.length === 0) return;
    const headers = ["Rank", "Username", "User ID", "Problems Solved", "Total Points", "Penalty Minutes"];
    const rows = contestLeaderboard.standings.map((u) =>
      [u.rank, u.username, u.userId, u.problems_solved, u.total_points, u.total_penalty_minutes].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tic-contest-${selectedContestId}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <LoadingSpinner label="Loading results..." />;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Results & Leaderboard</h1>
        <p className="mt-1.5 text-xs text-zinc-400">View contest results and campus-wide standings.</p>
      </div>

      {/* Contest Selector */}
      <div className="mb-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <label className="text-xs text-zinc-400">Contest:</label>
            <select
              value={selectedContestId}
              onChange={(e) => setSelectedContestId(e.target.value)}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
            >
              {contests.map((c) => (
                <option key={c.id} value={c.id}>{c.title} ({c.status})</option>
              ))}
            </select>
            <Link
              href={`/admin/contests/${selectedContestId}`}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              View Contest →
            </Link>
          </div>
          <button
            onClick={exportContestCSV}
            disabled={!contestLeaderboard || contestLeaderboard.standings.length === 0}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-40"
          >
            ⬇ Export Contest Results
          </button>
        </div>
      </div>

      {/* Contest Standings */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
        <div className="border-b border-zinc-800 p-5">
          <h3 className="text-sm font-semibold text-zinc-100">Contest Standings</h3>
          <p className="text-xs text-zinc-500">
            {contestLeaderboard?.contest_title || "Select a contest"}
          </p>
        </div>

        {lbLoading ? (
          <LoadingSpinner label="Loading standings..." />
        ) : contestLeaderboard && contestLeaderboard.standings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-500">
                  <th className="px-5 py-3 text-left">Rank</th>
                  <th className="px-5 py-3 text-left">Participant</th>
                  <th className="px-5 py-3 text-center">Solved</th>
                  <th className="px-5 py-3 text-center">Points</th>
                  <th className="px-5 py-3 text-center">Penalty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {contestLeaderboard.standings.map((u, i) => (
                  <tr key={u.userId} className="hover:bg-zinc-900/40 transition">
                    <td className="px-5 py-3">
                      <span className={`font-mono font-bold ${i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-orange-400" : "text-zinc-500"}`}>
                        #{u.rank}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-zinc-200">{u.username}</td>
                    <td className="px-5 py-3 text-center font-mono text-zinc-300">{u.problems_solved}</td>
                    <td className="px-5 py-3 text-center font-mono font-bold text-zinc-100">{u.total_points}</td>
                    <td className="px-5 py-3 text-center font-mono text-zinc-400">{u.total_penalty_minutes}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-zinc-500">No standings data for this contest.</div>
        )}
      </div>

      {/* Top 3 Podium */}
      {contestLeaderboard && contestLeaderboard.standings.length >= 3 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 0, 2].map((idx) => {
            const u = contestLeaderboard.standings[idx];
            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
            const styles = idx === 0 ? "border-amber-700/50 bg-amber-950/20" : idx === 1 ? "border-zinc-600/50 bg-zinc-800/30" : "border-orange-900/40 bg-orange-950/20";
            return (
              <div key={u.userId} className={`rounded-xl border p-5 ${styles}`}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-zinc-400">Rank {idx + 1}</span>
                  <span className="text-lg">{medal}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-zinc-100 truncate">{u.username}</p>
                <p className="mt-1 text-[11px] font-mono text-zinc-400">
                  {u.problems_solved} solved · {u.total_points} pts · {u.total_penalty_minutes}m penalty
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Global Leaderboard */}
      <div className="mt-8 rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-800 p-5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Global Campus Leaderboard</h3>
            <p className="text-xs text-zinc-500">All-time rankings by accepted submissions</p>
          </div>
          <button
            onClick={exportGlobalCSV}
            disabled={globalLeaderboard.length === 0}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-40"
          >
            ⬇ Export CSV
          </button>
        </div>
        {globalLeaderboard.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-500">
                  <th className="px-5 py-3 text-left">Rank</th>
                  <th className="px-5 py-3 text-left">Username</th>
                  <th className="px-5 py-3 text-right">Accepted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {globalLeaderboard.map((u) => (
                  <tr key={u.userId} className="hover:bg-zinc-900/40 transition">
                    <td className="px-5 py-3 font-mono font-bold text-zinc-400">#{u.rank}</td>
                    <td className="px-5 py-3 font-medium text-zinc-200">{u.username}</td>
                    <td className="px-5 py-3 text-right font-mono text-zinc-300">{u.accepted_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-zinc-500">No leaderboard data available.</div>
        )}
      </div>
    </div>
  );
}

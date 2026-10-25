"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetchSafe, apiFetch } from "@/lib/api";
import type { ContestDetail, ContestLeaderboard, Problem } from "@/lib/types";
import {
  LoadingSpinner, EmptyState, StatusBadge, DifficultyBadge, ErrorBanner,
} from "@/components/admin/AdminUI";

export default function AdminContestDetailPage() {
  const params = useParams();
  const contestId = (params?.id as string) || "";

  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [leaderboard, setLeaderboard] = useState<ContestLeaderboard | null>(null);
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddProblem, setShowAddProblem] = useState(false);
  const [toast, setToast] = useState("");

  async function loadData() {
    const [cData, lbData, pData] = await Promise.all([
      apiFetchSafe<ContestDetail>(`/contests/${contestId}`),
      apiFetchSafe<ContestLeaderboard>(`/contests/${contestId}/leaderboard`),
      apiFetchSafe<Problem[]>("/problems"),
    ]);
    if (cData) setContest(cData);
    else setError("Contest not found");
    if (lbData) setLeaderboard(lbData);
    if (pData) setAllProblems(pData);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [contestId]);

  async function handleAddProblem(pid: string) {
    // Backend does not have a dedicated "add problem to contest" endpoint.
    // We document this as a missing endpoint. The contest detail view is read-only for problems.
    setToast("Adding problems to an existing contest requires a backend endpoint (PUT /admin/contests/{id}/problems). Not yet available.");
    setTimeout(() => setToast(""), 5000);
  }

  if (loading) return <LoadingSpinner label="Loading contest..." />;

  if (!contest) {
    return (
      <div>
        <Link href="/admin/contests" className="text-xs text-zinc-400 hover:text-zinc-200">← Back to Contests</Link>
        <div className="mt-8"><EmptyState title="Contest not found" /></div>
      </div>
    );
  }

  const contestStart = new Date(contest.startTime);
  const contestEnd = new Date(contest.endTime);
  const now = new Date();
  const status = now < contestStart ? "UPCOMING" : now >= contestStart && now <= contestEnd ? "LIVE" : "ENDED";

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/admin/contests" className="hover:text-zinc-300 transition">Contests</Link>
        <span>/</span>
        <span className="font-mono text-zinc-300">{contestId}</span>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{contest.title}</h1>
              <StatusBadge status={status} />
            </div>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed max-w-2xl">{contest.description}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-mono text-zinc-500">
              <span>Start: <span className="text-zinc-400">{contestStart.toLocaleString()}</span></span>
              <span>End: <span className="text-zinc-400">{contestEnd.toLocaleString()}</span></span>
              <span>Duration: <span className="text-zinc-400">{Math.round((contestEnd.getTime() - contestStart.getTime()) / 60000)} min</span></span>
              <span>Problems: <span className="text-zinc-400">{contest.problems.length}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/contests/${contestId}/edit`}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
            >
              Edit Contest
            </Link>
            <Link
              href={`/contests/${contestId}`}
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
            >
              View Public →
            </Link>
          </div>
        </div>
      </div>

      {toast && (
        <div className="mt-4"><ErrorBanner message={toast} /></div>
      )}

      {/* Problems in Contest */}
      <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-800 p-5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Contest Problems</h3>
            <p className="text-xs text-zinc-500">{contest.problems.length} problems in this contest</p>
          </div>
          <button
            onClick={() => setShowAddProblem(!showAddProblem)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
          >
            + Add Problem
          </button>
        </div>

        {showAddProblem && (
          <div className="border-b border-zinc-800 p-4 bg-zinc-950/50">
            <p className="text-xs text-zinc-500 mb-3">Select problems not yet in this contest:</p>
            <div className="space-y-1.5">
              {allProblems
                .filter((p) => !contest.problems.some((cp) => cp.id === p.id))
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded p-2 hover:bg-zinc-900">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-zinc-200">{p.title}</span>
                      <DifficultyBadge difficulty={p.difficulty} />
                    </div>
                    <button
                      onClick={() => handleAddProblem(p.id)}
                      className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700"
                    >
                      Add
                    </button>
                  </div>
                ))}
              {allProblems.filter((p) => !contest.problems.some((cp) => cp.id === p.id)).length === 0 && (
                <p className="p-2 text-xs text-zinc-500">All problems are already in this contest.</p>
              )}
            </div>
          </div>
        )}

        <div className="divide-y divide-zinc-800/60">
          {contest.problems.map((p, idx) => (
            <div key={p.id} className="flex items-center justify-between p-4 hover:bg-zinc-900/40 transition">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-zinc-400">{String.fromCharCode(65 + idx)}</span>
                <div>
                  <Link href={`/admin/problems/${p.id}`} className="text-xs font-medium text-zinc-200 hover:text-zinc-100">
                    {p.title}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2">
                    <DifficultyBadge difficulty={p.difficulty} />
                    <span className="text-[11px] font-mono text-zinc-500">{p.points} pts</span>
                  </div>
                </div>
              </div>
              <Link
                href={`/problems/${p.id}`}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition"
              >
                Preview →
              </Link>
            </div>
          ))}
          {contest.problems.length === 0 && (
            <div className="p-8 text-center text-xs text-zinc-500">No problems added to this contest yet.</div>
          )}
        </div>
      </div>

      {/* Contest Leaderboard */}
      <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
        <div className="border-b border-zinc-800 p-5">
          <h3 className="text-sm font-semibold text-zinc-100">Contest Standings</h3>
          <p className="text-xs text-zinc-500">Live ICPC-style rankings</p>
        </div>

        {leaderboard && leaderboard.standings.length > 0 ? (
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
                {leaderboard.standings.map((u) => (
                  <tr key={u.userId} className="hover:bg-zinc-900/40 transition">
                    <td className="px-5 py-3 font-mono font-bold text-zinc-400">#{u.rank}</td>
                    <td className="px-5 py-3 font-medium text-zinc-200">{u.username}</td>
                    <td className="px-5 py-3 text-center font-mono text-zinc-300">{u.problems_solved} / {contest.problems.length}</td>
                    <td className="px-5 py-3 text-center font-mono font-bold text-zinc-100">{u.total_points}</td>
                    <td className="px-5 py-3 text-center font-mono text-zinc-400">{u.total_penalty_minutes}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-zinc-500">No submissions recorded yet.</div>
        )}
      </div>
    </div>
  );
}

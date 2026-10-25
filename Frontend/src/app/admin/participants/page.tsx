"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetchSafe, API_BASE_URL, getAuthToken } from "@/lib/api";
import type { LeaderboardUser, UserStats, Submission } from "@/lib/types";
import {
  LoadingSpinner, EmptyState, Pagination,
} from "@/components/admin/AdminUI";

interface ParticipantRow extends LeaderboardUser {
  email?: string;
  stats?: UserStats;
}

export default function AdminParticipantsPage() {
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"rank" | "name" | "solved">("rank");
  const [page, setPage] = useState(1);
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [userSubs, setUserSubs] = useState<Submission[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [modalLoading, setModalLoading] = useState(true);
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    async function load() {
      // The backend only has /leaderboard which returns users who have ACCEPTED submissions.
      // There is no /users endpoint to list all registered users.
      const lbData = await apiFetchSafe<{ leaderboard: LeaderboardUser[] }>("/leaderboard");
      if (lbData?.leaderboard) {
        const rows: ParticipantRow[] = lbData.leaderboard.map((u) => ({ ...u }));
        setParticipants(rows);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = participants;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.username.toLowerCase().includes(q) || p.userId.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      if (sortBy === "name") return a.username.localeCompare(b.username);
      if (sortBy === "solved") return b.accepted_count - a.accepted_count;
      return a.rank - b.rank;
    });
    return result;
  }, [participants, search, sortBy]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  async function openParticipant(userId: string) {
    setViewUserId(userId);
    setModalLoading(true);
    const [subsData, statsData] = await Promise.all([
      apiFetchSafe<{ count: number; submissions: Submission[] }>(`/users/${userId}/submissions`),
      apiFetchSafe<UserStats>(`/users/${userId}/stats`),
    ]);
    if (subsData?.submissions) setUserSubs(subsData.submissions);
    else setUserSubs([]);
    if (statsData) setUserStats(statsData);
    else setUserStats(null);
    setModalLoading(false);
  }

  function exportCSV() {
    const headers = ["Rank", "Username", "User ID", "Accepted Count"];
    const rows = filtered.map((p) => [p.rank, p.username, p.userId, p.accepted_count].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tic-participants.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <LoadingSpinner label="Loading participants..." />;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Participants</h1>
          <p className="mt-1.5 text-xs text-zinc-400">View registered students and their contest participation.</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-40"
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Info note */}
      <div className="mb-6 rounded-lg border border-zinc-800/60 bg-zinc-900/20 p-4">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          <span className="font-mono text-zinc-400">Note:</span> The backend does not have a dedicated <code className="font-mono text-zinc-400">GET /users</code> endpoint. Participants shown here are those with at least one accepted submission from the leaderboard. A full user list requires a backend endpoint.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or user ID..."
          className="flex-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
        >
          <option value="rank">Sort by Rank</option>
          <option value="name">Sort by Name</option>
          <option value="solved">Sort by Solved</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No participants found" description="No users have accepted submissions yet." />
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-500">
                    <th className="px-5 py-3 text-left">Rank</th>
                    <th className="px-5 py-3 text-left">Username</th>
                    <th className="px-5 py-3 text-left">User ID</th>
                    <th className="px-5 py-3 text-center">Accepted</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {paged.map((p) => (
                    <tr key={p.userId} className="hover:bg-zinc-900/40 transition">
                      <td className="px-5 py-3 font-mono font-bold text-zinc-400">#{p.rank}</td>
                      <td className="px-5 py-3 font-medium text-zinc-200">{p.username}</td>
                      <td className="px-5 py-3 font-mono text-zinc-500 truncate max-w-[180px]">{p.userId}</td>
                      <td className="px-5 py-3 text-center font-mono text-zinc-300">{p.accepted_count}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => openParticipant(p.userId)}
                          className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 transition"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Participant Detail Modal */}
      {viewUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <button onClick={() => setViewUserId(null)} className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-200 text-xs">✕</button>
            <h2 className="text-base font-semibold text-zinc-100">Participant Profile</h2>
            <p className="mt-1 text-[11px] font-mono text-zinc-500">User ID: {viewUserId}</p>

            {modalLoading ? (
              <div className="py-12 text-center"><LoadingSpinner label="Loading profile..." /></div>
            ) : (
              <div className="mt-5 space-y-6">
                {/* Stats */}
                {userStats ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-center">
                      <p className="text-[10px] font-mono uppercase text-zinc-500">Total Attempts</p>
                      <p className="mt-1 text-lg font-bold font-mono text-zinc-100">{userStats.total_attempts}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-center">
                      <p className="text-[10px] font-mono uppercase text-zinc-500">Accepted</p>
                      <p className="mt-1 text-lg font-bold font-mono text-emerald-400">{userStats.accepted_attempts}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-center">
                      <p className="text-[10px] font-mono uppercase text-zinc-500">Win Rate</p>
                      <p className="mt-1 text-lg font-bold font-mono text-zinc-100">{userStats.win_rate_percentage}%</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">No stats available. Backend may not have this user's records.</p>
                )}

                {/* Submissions */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200 mb-3">Recent Submissions ({userSubs.length})</h3>
                  {userSubs.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userSubs.slice(0, 20).map((s) => (
                        <div key={s.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-zinc-400">{s.problemId}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-mono ${
                              s.status === "ACCEPTED" ? "bg-emerald-950/30 text-emerald-400" : "bg-red-950/30 text-red-400"
                            }`}>
                              {s.status}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] font-mono text-zinc-500">
                            Lang: {s.languageId} · {new Date(s.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">No submissions recorded.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

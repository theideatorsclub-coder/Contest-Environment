"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch, apiFetchSafe } from "@/lib/api";
import type { UserStats, Submission } from "@/lib/types";
import {
  LoadingSpinner, EmptyState, ErrorBanner, Pagination,
} from "@/components/admin/AdminUI";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  submission_count: number;
  accepted_count: number;
}

interface UsersResponse {
  total: number;
  count: number;
  users: AdminUser[];
}

const LANG_MAP: Record<number, string> = {
  71: "Python 3", 54: "C++", 62: "Java", 63: "JavaScript", 74: "TypeScript", 50: "C",
};

export default function AdminParticipantsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"name" | "accepted" | "joined">("joined");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  const [viewUser, setViewUser] = useState<AdminUser | null>(null);
  const [userSubs, setUserSubs] = useState<Submission[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await apiFetch<UsersResponse>(`/admin/users?limit=200`);
        setUsers(data.users);
        setTotal(data.total);
      } catch (err: any) {
        setError(err.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = users;
    if (roleFilter !== "ALL") result = result.filter((u) => u.role === roleFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q),
      );
    }
    result = [...result].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "accepted") return b.accepted_count - a.accepted_count;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return result;
  }, [users, search, roleFilter, sortBy]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  async function openParticipant(user: AdminUser) {
    setViewUser(user);
    setModalLoading(true);
    setUserSubs([]);
    setUserStats(null);
    const [subsData, statsData] = await Promise.all([
      apiFetchSafe<{ count: number; submissions: Submission[] }>(`/users/${user.id}/submissions`),
      apiFetchSafe<UserStats>(`/users/${user.id}/stats`),
    ]);
    if (subsData?.submissions) setUserSubs(subsData.submissions.slice(0, 20));
    if (statsData) setUserStats(statsData);
    setModalLoading(false);
  }

  function exportCSV() {
    const headers = ["Name", "Email", "Role", "Accepted", "Submissions", "Joined"];
    const rows = filtered.map((u) =>
      [u.name, u.email, u.role, u.accepted_count, u.submission_count, new Date(u.createdAt).toLocaleDateString()].join(","),
    );
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
          <p className="mt-1.5 text-xs text-zinc-400">
            All registered users — {total} total.
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-40"
        >
          ⬇ Export CSV
        </button>
      </div>

      {error && <div className="mb-6"><ErrorBanner message={error} /></div>}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, email, or ID..."
          className="flex-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
        >
          <option value="ALL">All Roles</option>
          <option value="STUDENT">Students</option>
          <option value="ADMIN">Admins</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
        >
          <option value="joined">Sort by Joined</option>
          <option value="name">Sort by Name</option>
          <option value="accepted">Sort by Accepted</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No participants found" description="No users match the current filters." />
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-500">
                    <th className="px-5 py-3 text-left">Name</th>
                    <th className="px-5 py-3 text-left">Email</th>
                    <th className="px-5 py-3 text-center">Role</th>
                    <th className="px-5 py-3 text-center">Accepted</th>
                    <th className="px-5 py-3 text-center">Submissions</th>
                    <th className="px-5 py-3 text-left">Joined</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {paged.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-900/40 transition">
                      <td className="px-5 py-3 font-medium text-zinc-200">{u.name}</td>
                      <td className="px-5 py-3 text-zinc-400 font-mono text-[11px]">{u.email}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase border ${
                          u.role === "ADMIN"
                            ? "bg-zinc-800 text-zinc-200 border-zinc-700"
                            : "bg-zinc-900 text-zinc-400 border-zinc-800"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center font-mono text-emerald-400">{u.accepted_count}</td>
                      <td className="px-5 py-3 text-center font-mono text-zinc-400">{u.submission_count}</td>
                      <td className="px-5 py-3 text-zinc-500 font-mono text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => openParticipant(u)}
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
      {viewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <button
              onClick={() => setViewUser(null)}
              className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-200 text-xs"
            >
              ✕
            </button>
            <h2 className="text-base font-semibold text-zinc-100">{viewUser.name}</h2>
            <p className="mt-0.5 text-[11px] font-mono text-zinc-500">{viewUser.email} · {viewUser.id}</p>

            {modalLoading ? (
              <div className="py-12 text-center"><LoadingSpinner label="Loading profile..." /></div>
            ) : (
              <div className="mt-5 space-y-5">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-center">
                    <p className="text-[10px] font-mono uppercase text-zinc-500">Total Attempts</p>
                    <p className="mt-1 text-xl font-bold font-mono text-zinc-100">
                      {userStats?.total_attempts ?? viewUser.submission_count}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-center">
                    <p className="text-[10px] font-mono uppercase text-zinc-500">Accepted</p>
                    <p className="mt-1 text-xl font-bold font-mono text-emerald-400">
                      {userStats?.accepted_attempts ?? viewUser.accepted_count}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-center">
                    <p className="text-[10px] font-mono uppercase text-zinc-500">Win Rate</p>
                    <p className="mt-1 text-xl font-bold font-mono text-zinc-100">
                      {userStats?.win_rate_percentage ?? "—"}%
                    </p>
                  </div>
                </div>

                {/* Recent Submissions */}
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200 mb-3">
                    Recent Submissions ({userSubs.length})
                  </h3>
                  {userSubs.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {userSubs.map((s) => (
                        <div key={s.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-mono text-zinc-300">{s.problemId}</span>
                            <p className="mt-0.5 text-[10px] font-mono text-zinc-500">
                              {LANG_MAP[s.languageId] || `#${s.languageId}`} · {new Date(s.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-mono border ${
                            s.status === "ACCEPTED"
                              ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/40"
                              : "bg-red-950/30 text-red-400 border-red-900/40"
                          }`}>
                            {s.status}
                          </span>
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

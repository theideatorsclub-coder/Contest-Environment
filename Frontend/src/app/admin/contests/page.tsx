"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { apiFetch, apiFetchSafe, getAuthToken } from "@/lib/api";
import type { Contest, Problem } from "@/lib/types";
import {
  LoadingSpinner, EmptyState, StatusBadge, ErrorBanner, SuccessBanner,
  ConfirmDialog, Toast, Pagination,
} from "@/components/admin/AdminUI";

export default function AdminContestsPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"title" | "startTime" | "status">("startTime");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // Create modal
  const [showCreate, setShowCreate] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = useState("");

  async function loadData() {
    const [cData, pData] = await Promise.all([
      apiFetchSafe<Contest[]>("/contests"),
      apiFetchSafe<Problem[]>("/problems"),
    ]);
    if (cData) setContests(cData);
    if (pData) setProblems(pData);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filtered + sorted contests
  const filtered = useMemo(() => {
    let result = contests;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "ALL") {
      result = result.filter((c) => c.status === statusFilter);
    }

    result = [...result].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "startTime") return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      return a.status.localeCompare(b.status);
    });

    return result;
  }, [contests, search, statusFilter, sortBy]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await apiFetch(`/admin/contests/${deleteId}`, {
        method: "DELETE",
        token: getAuthToken(),
      });
      setContests(contests.filter((c) => c.id !== deleteId));
      setToast({ msg: `Contest "${deleteTitle}" deleted.`, type: "success" });
    } catch (err: any) {
      setToast({ msg: err.message || "Failed to delete contest.", type: "error" });
    }
    setDeleteId(null);
  }

  if (loading) return <LoadingSpinner label="Loading contests..." />;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Contest Management</h1>
          <p className="mt-1.5 text-xs text-zinc-400">Create, edit, and manage contest rounds.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
        >
          + New Contest
        </button>
      </div>

      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by title or ID..."
          className="flex-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="LIVE">Live</option>
          <option value="UPCOMING">Upcoming</option>
          <option value="ENDED">Completed</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
        >
          <option value="startTime">Sort by Date</option>
          <option value="title">Sort by Title</option>
          <option value="status">Sort by Status</option>
        </select>
      </div>

      {/* Contest List */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No contests found"
          description="Create a new contest to get started."
          actionLabel="+ New Contest"
          actionHref="/admin/contests"
        />
      ) : (
        <>
          <div className="space-y-3">
            {paged.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 transition hover:border-zinc-700"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5">
                      <Link href={`/admin/contests/${c.id}`} className="text-sm font-semibold text-zinc-100 hover:text-white">
                        {c.title}
                      </Link>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-400 line-clamp-2">{c.description}</p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-mono text-zinc-500">
                      <span>ID: <span className="text-zinc-400">{c.id}</span></span>
                      <span>Start: <span className="text-zinc-400">{new Date(c.startTime).toLocaleString()}</span></span>
                      <span>End: <span className="text-zinc-400">{new Date(c.endTime).toLocaleString()}</span></span>
                      <span>Problems: <span className="text-zinc-400">{c.problem_count}</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/admin/contests/${c.id}`}
                      className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
                    >
                      View →
                    </Link>
                    <Link
                      href={`/admin/contests/${c.id}/edit`}
                      className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => { setDeleteId(c.id); setDeleteTitle(c.title); }}
                      className="rounded-md border border-red-900/40 bg-red-950/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950/40 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Create Contest Modal */}
      {showCreate && (
        <CreateContestModal
          problems={problems}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadData(); }}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete Contest"
        message={`Are you sure you want to delete "${deleteTitle}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

// ---- Create Contest Modal ----
function CreateContestModal({
  problems,
  onClose,
  onCreated,
}: {
  problems: Problem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validation
    if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
      setError("End time must be after start time.");
      return;
    }
    if (!id.trim() || !title.trim() || !description.trim()) {
      setError("All fields are required.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/admin/contests", {
        method: "POST",
        body: JSON.stringify({
          id: id.trim(),
          title: title.trim(),
          description: description.trim(),
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          problem_ids: selectedProblems,
        }),
        token: getAuthToken(),
      });
      onCreated();
    } catch (err: any) {
      setError(err.message || "Failed to create contest");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-200 text-xs">
          ✕
        </button>
        <h2 className="text-base font-semibold text-zinc-100">Create New Contest</h2>
        <p className="mt-1 text-xs text-zinc-500">Schedule a contest round and select problems.</p>

        {error && <div className="mt-4"><ErrorBanner message={error} /></div>}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Contest ID (Slug)</label>
              <input
                type="text" required value={id} onChange={(e) => setId(e.target.value)}
                placeholder="tic-weekly-2"
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Title</label>
              <input
                type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="TIC Weekly Contest #2"
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Description</label>
            <textarea
              required rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Contest description and rules..."
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Start Time</label>
              <input
                type="datetime-local" required value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">End Time</label>
              <input
                type="datetime-local" required value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Problem selection */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">
              Select Problems ({selectedProblems.length} selected)
            </label>
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950 p-2.5">
              {problems.length === 0 ? (
                <p className="p-2 text-xs text-zinc-500">No problems available. Create problems first.</p>
              ) : (
                problems.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded p-2 text-xs hover:bg-zinc-900">
                    <input
                      type="checkbox" checked={selectedProblems.includes(p.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedProblems([...selectedProblems, p.id]);
                        else setSelectedProblems(selectedProblems.filter((x) => x !== p.id));
                      }}
                      className="rounded border-zinc-700 bg-zinc-900 text-zinc-100"
                    />
                    <span className="font-medium text-zinc-200">{p.title}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">({p.difficulty})</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full rounded-md bg-zinc-100 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Contest"}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { apiFetch, apiFetchSafe, getAuthToken } from "@/lib/api";
import type { Problem } from "@/lib/types";
import {
  LoadingSpinner, EmptyState, DifficultyBadge, ConfirmDialog, Toast, Pagination,
} from "@/components/admin/AdminUI";

export default function AdminProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [diffFilter, setDiffFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const ITEMS_PER_PAGE = 10;

  async function loadData() {
    const data = await apiFetchSafe<Problem[]>("/problems");
    if (data) setProblems(data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    let result = problems;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
      );
    }
    if (diffFilter !== "ALL") {
      result = result.filter((p) => (p.difficulty || "").toLowerCase() === diffFilter.toLowerCase());
    }
    return result;
  }, [problems, search, diffFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await apiFetch(`/admin/problems/${deleteId}`, {
        method: "DELETE",
        token: getAuthToken(),
      });
      setProblems(problems.filter((p) => p.id !== deleteId));
      setToast({ msg: `Problem "${deleteTitle}" deleted successfully.`, type: "success" });
    } catch (err: any) {
      setToast({ msg: err.message || "Failed to delete problem.", type: "error" });
    }
    setDeleteId(null);
  }

  if (loading) return <LoadingSpinner label="Loading problems..." />;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Question Bank</h1>
          <p className="mt-1.5 text-xs text-zinc-400">Create, edit, and manage coding problems.</p>
        </div>
        <Link
          href="/admin/problems/new"
          className="rounded-md bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
        >
          + New Problem
        </Link>
      </div>

      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
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
        <div className="flex gap-1.5">
          {["ALL", "Easy", "Medium", "Hard"].map((d) => (
            <button
              key={d}
              onClick={() => { setDiffFilter(d.toUpperCase()); setPage(1); }}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                diffFilter === d.toUpperCase()
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {d === "ALL" ? "All" : d}
            </button>
          ))}
        </div>
      </div>

      {/* Problems Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No problems found"
          description="Create a new problem to add to the question bank."
          actionLabel="+ New Problem"
          actionHref="/admin/problems/new"
        />
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-500">
                    <th className="px-5 py-3 text-left">Title</th>
                    <th className="px-5 py-3 text-left">ID</th>
                    <th className="px-5 py-3 text-left">Difficulty</th>
                    <th className="px-5 py-3 text-center">Test Cases</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {paged.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-900/40 transition">
                      <td className="px-5 py-3">
                        <Link href={`/admin/problems/${p.id}`} className="font-medium text-zinc-200 hover:text-zinc-100">
                          {p.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-mono text-zinc-500">{p.id}</td>
                      <td className="px-5 py-3"><DifficultyBadge difficulty={p.difficulty} /></td>
                      <td className="px-5 py-3 text-center font-mono text-zinc-400">{p.test_cases_count || 0}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/problems/${p.id}`}
                            className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 transition"
                          >
                            View
                          </Link>
                          <Link
                            href={`/admin/problems/${p.id}/edit`}
                            className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 transition"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => { setDeleteId(p.id); setDeleteTitle(p.title); }}
                            className="rounded border border-red-900/40 bg-red-950/20 px-2.5 py-1 text-[11px] text-red-400 hover:bg-red-950/40 transition"
                          >
                            Delete
                          </button>
                        </div>
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

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete Problem"
        message={`Delete "${deleteTitle}"? This removes the problem and all its test cases. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

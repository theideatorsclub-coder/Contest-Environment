"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { apiFetch, apiFetchSafe } from "@/lib/api";
import type { Contest, Problem } from "@/lib/types";
import {
  LoadingSpinner, EmptyState, StatusBadge, ErrorBanner, Pagination,
} from "@/components/admin/AdminUI";

const VERDICT_FILTERS = [
  "ALL", "ACCEPTED", "WRONG_ANSWER", "COMPILATION_ERROR",
  "TIME_LIMIT_EXCEEDED", "RUNTIME_ERROR", "PENDING", "IN_QUEUE", "PROCESSING",
];

const LANG_MAP: Record<number, string> = {
  71: "Python 3", 54: "C++", 62: "Java", 63: "JavaScript", 74: "TypeScript", 50: "C",
};

interface AdminSubmission {
  id: string;
  status: string;
  languageId: number;
  problemId: string;
  problemTitle: string;
  userId: string;
  userEmail: string;
  contestId: string | null;
  executionTime: string | null;
  memory: number | null;
  createdAt: string;
}

interface SubmissionsResponse {
  total: number;
  count: number;
  submissions: AdminSubmission[];
}

export default function AdminSubmissionsPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("ALL");
  const [contestFilter, setContestFilter] = useState("ALL");
  const [problemFilter, setProblemFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const [selectedSub, setSelectedSub] = useState<AdminSubmission | null>(null);
  const [subDetail, setSubDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadRefData = useCallback(async () => {
    const [cData, pData] = await Promise.all([
      apiFetchSafe<Contest[]>("/contests"),
      apiFetchSafe<Problem[]>("/problems"),
    ]);
    if (cData) setContests(cData);
    if (pData) setProblems(pData);
  }, []);

  const loadSubmissions = useCallback(async (pg: number = 1) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        offset: String((pg - 1) * ITEMS_PER_PAGE),
      });
      if (verdictFilter !== "ALL") params.set("status", verdictFilter);
      if (problemFilter !== "ALL") params.set("problem_id", problemFilter);
      if (contestFilter !== "ALL") params.set("contest_id", contestFilter);

      const data = await apiFetch<SubmissionsResponse>(`/admin/submissions?${params}`);
      setSubmissions(data.submissions);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, [verdictFilter, problemFilter, contestFilter]);

  useEffect(() => {
    loadRefData();
  }, [loadRefData]);

  useEffect(() => {
    loadSubmissions(page);
  }, [loadSubmissions, page]);

  // Client-side search filter (on already-loaded page)
  const filtered = useMemo(() => {
    if (!search) return submissions;
    const q = search.toLowerCase();
    return submissions.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.userEmail.toLowerCase().includes(q) ||
        s.problemTitle.toLowerCase().includes(q) ||
        s.problemId.toLowerCase().includes(q),
    );
  }, [submissions, search]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const handlePageChange = (p: number) => {
    setPage(p);
  };

  const handleFilterChange = () => {
    setPage(1);
    loadSubmissions(1);
  };

  const openDetail = async (sub: AdminSubmission) => {
    setSelectedSub(sub);
    setSubDetail(null);
    setDetailLoading(true);
    try {
      const detail = await apiFetch(`/status/${sub.id}`);
      setSubDetail(detail);
    } catch {
      setSubDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Submissions</h1>
        <p className="mt-1.5 text-xs text-zinc-400">
          All contest and practice submissions — {total} total.
        </p>
      </div>

      {error && <div className="mb-6"><ErrorBanner message={error} /></div>}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ID, user email, or problem..."
          className="flex-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
        <select
          value={verdictFilter}
          onChange={(e) => { setVerdictFilter(e.target.value); handleFilterChange(); }}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
        >
          {VERDICT_FILTERS.map((v) => (
            <option key={v} value={v}>{v === "ALL" ? "All Verdicts" : v.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          value={contestFilter}
          onChange={(e) => { setContestFilter(e.target.value); handleFilterChange(); }}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
        >
          <option value="ALL">All Contests</option>
          <option value="null">Practice (No Contest)</option>
          {contests.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <select
          value={problemFilter}
          onChange={(e) => { setProblemFilter(e.target.value); handleFilterChange(); }}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
        >
          <option value="ALL">All Problems</option>
          {problems.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <button
          onClick={() => loadSubmissions(page)}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading submissions..." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No submissions found" description="Try adjusting your filters or check back later." />
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-500">
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Problem</th>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-center">Lang</th>
                    <th className="px-4 py-3 text-left">Verdict</th>
                    <th className="px-4 py-3 text-left">Time</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-zinc-900/40 transition cursor-pointer"
                      onClick={() => openDetail(s)}
                    >
                      <td className="px-4 py-3 font-mono text-zinc-500 truncate max-w-[100px]">
                        {s.id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3 text-zinc-300 truncate max-w-[140px]">{s.problemTitle}</td>
                      <td className="px-4 py-3 text-zinc-400 truncate max-w-[120px]">{s.userEmail}</td>
                      <td className="px-4 py-3 text-center font-mono text-zinc-500">
                        {LANG_MAP[s.languageId] || `#${s.languageId}`}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 text-zinc-500 font-mono text-[11px]">
                        {new Date(s.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); openDetail(s); }}
                          className="text-[11px] text-zinc-400 hover:text-zinc-200 transition"
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}

      {/* Submission Detail Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <button
              onClick={() => { setSelectedSub(null); setSubDetail(null); }}
              className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-200 text-xs"
            >
              ✕
            </button>
            <h2 className="text-base font-semibold text-zinc-100 mb-4">Submission Detail</h2>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div><span className="text-zinc-500">Problem:</span> <span className="text-zinc-200">{selectedSub.problemTitle}</span></div>
              <div><span className="text-zinc-500">User:</span> <span className="text-zinc-200">{selectedSub.userEmail}</span></div>
              <div><span className="text-zinc-500">Language:</span> <span className="font-mono text-zinc-300">{LANG_MAP[selectedSub.languageId] || `#${selectedSub.languageId}`}</span></div>
              <div><span className="text-zinc-500">Contest:</span> <span className="font-mono text-zinc-300">{selectedSub.contestId || "Practice"}</span></div>
              <div><span className="text-zinc-500">Verdict:</span> <StatusBadge status={selectedSub.status} /></div>
              <div><span className="text-zinc-500">Submitted:</span> <span className="font-mono text-zinc-300">{new Date(selectedSub.createdAt).toLocaleString()}</span></div>
            </div>

            {detailLoading && <p className="text-xs text-zinc-500 font-mono">Loading details…</p>}

            {subDetail && (
              <>
                {subDetail.execution_time && (
                  <p className="text-xs text-zinc-400 mb-3 font-mono">
                    Exec time: {subDetail.execution_time}s · Memory: {subDetail.memory ?? "—"} KB
                  </p>
                )}
                {subDetail.stdout && (
                  <div className="mt-2">
                    <span className="text-[10px] uppercase text-zinc-500">Stdout</span>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-zinc-950 border border-zinc-800/80 p-3 text-xs font-mono text-zinc-200 whitespace-pre-wrap">{subDetail.stdout}</pre>
                  </div>
                )}
                {subDetail.stderr && (
                  <div className="mt-3">
                    <span className="text-[10px] uppercase text-red-400">Stderr</span>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-red-950/20 border border-red-900/40 p-3 text-xs font-mono text-red-300 whitespace-pre-wrap">{subDetail.stderr}</pre>
                  </div>
                )}
                {subDetail.compile_output && (
                  <div className="mt-3">
                    <span className="text-[10px] uppercase text-orange-400">Compiler Output</span>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-orange-950/20 border border-orange-900/40 p-3 text-xs font-mono text-orange-300 whitespace-pre-wrap">{subDetail.compile_output}</pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

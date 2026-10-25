"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetchSafe, API_BASE_URL, getAuthToken } from "@/lib/api";
import type { Contest, Problem, Submission, SubmissionStatus } from "@/lib/types";
import {
  LoadingSpinner, EmptyState, StatusBadge, Pagination,
} from "@/components/admin/AdminUI";

const VERDICT_FILTERS = ["ALL", "ACCEPTED", "WRONG_ANSWER", "COMPILATION_ERROR", "TIME_LIMIT_EXCEEDED", "RUNTIME_ERROR", "PENDING"];

export default function AdminSubmissionsPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("ALL");
  const [contestFilter, setContestFilter] = useState("ALL");
  const [problemFilter, setProblemFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Selected submission for detail view
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);

  async function loadRefData() {
    const [cData, pData] = await Promise.all([
      apiFetchSafe<Contest[]>("/contests"),
      apiFetchSafe<Problem[]>("/problems"),
    ]);
    if (cData) setContests(cData);
    if (pData) setProblems(pData);
  }

  async function loadSubmissions() {
    // The backend does not have a "list all submissions" endpoint.
    // We try /admin/submissions (missing) or fall back to per-user polling.
    // For now, we document this as a missing endpoint.
    setError("The backend does not have a GET /admin/submissions endpoint to list all submissions. " +
      "This page requires that endpoint to show submissions across all users and contests. " +
      "Available per-user endpoints: GET /users/{user_id}/submissions, GET /users/{user_id}/stats");
    setLoading(false);
  }

  useEffect(() => {
    loadRefData();
    loadSubmissions();
  }, []);

  // Filtered submissions (will be empty until backend endpoint exists)
  const filtered = useMemo(() => {
    let result = submissions;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.id.toLowerCase().includes(q) || s.userId.toLowerCase().includes(q) || s.problemId.toLowerCase().includes(q));
    }
    if (verdictFilter !== "ALL") result = result.filter((s) => s.status === verdictFilter);
    if (contestFilter !== "ALL") result = result.filter((s) => s.contestId === contestFilter);
    if (problemFilter !== "ALL") result = result.filter((s) => s.problemId === problemFilter);
    return result;
  }, [submissions, search, verdictFilter, contestFilter, problemFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Submissions</h1>
        <p className="mt-1.5 text-xs text-zinc-400">Review all contest and practice submissions across the platform.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-amber-900/40 bg-amber-950/20 px-4 py-2.5 text-xs text-amber-400">
          {error}
        </div>
      )}

      {/* Filters — always show, will be functional once backend endpoint exists */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by submission ID, user, or problem..."
          className="flex-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
        <select
          value={verdictFilter}
          onChange={(e) => { setVerdictFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
        >
          {VERDICT_FILTERS.map((v) => (
            <option key={v} value={v}>{v === "ALL" ? "All Verdicts" : v.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          value={contestFilter}
          onChange={(e) => { setContestFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
        >
          <option value="ALL">All Contests</option>
          {contests.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <select
          value={problemFilter}
          onChange={(e) => { setProblemFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
        >
          <option value="ALL">All Problems</option>
          {problems.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No submissions to display"
          description="The backend needs a GET /admin/submissions endpoint to list all submissions. Per-user submissions are available via GET /users/{user_id}/submissions."
        />
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-500">
                    <th className="px-4 py-3 text-left">Submission ID</th>
                    <th className="px-4 py-3 text-left">Problem</th>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-center">Lang</th>
                    <th className="px-4 py-3 text-left">Verdict</th>
                    <th className="px-4 py-3 text-left">Time</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {paged.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-900/40 transition cursor-pointer" onClick={() => setSelectedSub(s)}>
                      <td className="px-4 py-3 font-mono text-zinc-500 truncate max-w-[120px]">{s.id}</td>
                      <td className="px-4 py-3 text-zinc-300">{s.problemId}</td>
                      <td className="px-4 py-3 font-mono text-zinc-400 truncate max-w-[100px]">{s.userId}</td>
                      <td className="px-4 py-3 text-center font-mono text-zinc-500">{s.languageId}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 text-zinc-500 font-mono text-[11px]">{new Date(s.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedSub(s); }} className="text-[11px] text-zinc-400 hover:text-zinc-200">View</button>
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

      {/* Submission Detail Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <button onClick={() => setSelectedSub(null)} className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-200 text-xs">✕</button>
            <h2 className="text-base font-semibold text-zinc-100">Submission Detail</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div><span className="text-zinc-500">ID:</span> <span className="font-mono text-zinc-300">{selectedSub.id}</span></div>
              <div><span className="text-zinc-500">Problem:</span> <span className="text-zinc-300">{selectedSub.problemId}</span></div>
              <div><span className="text-zinc-500">User:</span> <span className="font-mono text-zinc-300">{selectedSub.userId}</span></div>
              <div><span className="text-zinc-500">Language ID:</span> <span className="font-mono text-zinc-300">{selectedSub.languageId}</span></div>
              <div><span className="text-zinc-500">Status:</span> <StatusBadge status={selectedSub.status} /></div>
              <div><span className="text-zinc-500">Time:</span> <span className="font-mono text-zinc-300">{selectedSub.executionTime || "—"}</span></div>
              <div><span className="text-zinc-500">Memory:</span> <span className="font-mono text-zinc-300">{selectedSub.memory || "—"}</span></div>
              <div><span className="text-zinc-500">Submitted:</span> <span className="font-mono text-zinc-300">{new Date(selectedSub.createdAt).toLocaleString()}</span></div>
            </div>

            {selectedSub.stdout && (
              <div className="mt-4">
                <span className="text-[10px] uppercase text-zinc-500">Stdout</span>
                <pre className="mt-1 rounded bg-zinc-950 border border-zinc-800/80 p-3 text-xs font-mono text-zinc-200 whitespace-pre-wrap overflow-x-auto">{selectedSub.stdout}</pre>
              </div>
            )}
            {selectedSub.stderr && (
              <div className="mt-3">
                <span className="text-[10px] uppercase text-red-400">Stderr</span>
                <pre className="mt-1 rounded bg-red-950/20 border border-red-900/40 p-3 text-xs font-mono text-red-300 whitespace-pre-wrap overflow-x-auto">{selectedSub.stderr}</pre>
              </div>
            )}
            {selectedSub.compileOutput && (
              <div className="mt-3">
                <span className="text-[10px] uppercase text-orange-400">Compiler Output</span>
                <pre className="mt-1 rounded bg-orange-950/20 border border-orange-900/40 p-3 text-xs font-mono text-orange-300 whitespace-pre-wrap overflow-x-auto">{selectedSub.compileOutput}</pre>
              </div>
            )}

            {/* Source code */}
            <div className="mt-4">
              <span className="text-[10px] uppercase text-zinc-500">Source Code</span>
              <pre className="mt-1 max-h-60 overflow-auto rounded bg-zinc-950 border border-zinc-800/80 p-3 text-xs font-mono text-zinc-200 whitespace-pre-wrap">{selectedSub.code}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

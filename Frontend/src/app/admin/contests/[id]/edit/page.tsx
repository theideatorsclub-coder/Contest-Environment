"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetchSafe, apiFetch, getAuthToken } from "@/lib/api";
import type { ContestDetail, Problem } from "@/lib/types";
import { LoadingSpinner, ErrorBanner, SuccessBanner, DifficultyBadge } from "@/components/admin/AdminUI";

export default function AdminEditContestPage() {
  const params = useParams();
  const router = useRouter();
  const contestId = (params?.id as string) || "";

  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProblems, setSavingProblems] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [problemSuccess, setProblemSuccess] = useState("");

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);

  async function loadData() {
    const [cData, pData] = await Promise.all([
      apiFetchSafe<ContestDetail>(`/contests/${contestId}`),
      apiFetchSafe<Problem[]>("/problems"),
    ]);
    if (cData) {
      setContest(cData);
      setTitle(cData.title);
      setDescription(cData.description);
      // Format for datetime-local input: YYYY-MM-DDTHH:mm
      const fmtLocal = (iso: string) => {
        const d = new Date(iso);
        const offset = d.getTimezoneOffset();
        return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
      };
      setStartTime(fmtLocal(cData.startTime));
      setEndTime(fmtLocal(cData.endTime));
      setSelectedProblems(cData.problems.map((p) => p.id));
    }
    if (pData) setAllProblems(pData);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [contestId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
      setError("End time must be after start time.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/admin/contests/${contestId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
        }),
        token: getAuthToken(),
      });
      setSuccess("Contest details updated successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update contest.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProblems() {
    setProblemSuccess("");
    setError("");
    setSavingProblems(true);
    try {
      await apiFetch(`/admin/contests/${contestId}/problems`, {
        method: "PUT",
        body: JSON.stringify({ problem_ids: selectedProblems }),
        token: getAuthToken(),
      });
      setProblemSuccess(`Problem set updated — ${selectedProblems.length} problem(s) assigned.`);
      setTimeout(() => setProblemSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update problems.");
    } finally {
      setSavingProblems(false);
    }
  }

  function toggleProblem(pid: string) {
    setSelectedProblems((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]
    );
  }

  if (loading) return <LoadingSpinner label="Loading contest..." />;

  if (!contest) {
    return (
      <div>
        <Link href="/admin/contests" className="text-xs text-zinc-400 hover:text-zinc-200">← Back to Contests</Link>
        <p className="mt-8 text-sm text-zinc-500">Contest not found.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/admin/contests" className="hover:text-zinc-300 transition">Contests</Link>
        <span>/</span>
        <Link href={`/admin/contests/${contestId}`} className="hover:text-zinc-300 transition font-mono">{contestId}</Link>
        <span>/</span>
        <span className="text-zinc-300">Edit</span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Edit Contest</h1>
      <p className="mt-1.5 text-xs text-zinc-400">Update contest details, schedule, and problem set.</p>

      {error && <div className="mt-4"><ErrorBanner message={error} /></div>}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — Contest Details */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
          <h2 className="text-sm font-semibold text-zinc-100 mb-4">Contest Details</h2>
          {success && <div className="mb-4"><SuccessBanner message={success} /></div>}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Contest ID</label>
              <input
                type="text" disabled value={contest.id}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs font-mono text-zinc-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Title</label>
              <input
                type="text" required value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Description</label>
              <textarea
                required rows={4} value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none resize-y"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Start Time</label>
                <input
                  type="datetime-local" required value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">End Time</label>
                <input
                  type="datetime-local" required value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit" disabled={saving}
                className="rounded-md bg-zinc-100 px-5 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Details"}
              </button>
              <Link
                href={`/admin/contests/${contestId}`}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* Right — Problem Set */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
          <h2 className="text-sm font-semibold text-zinc-100 mb-1">Problem Set</h2>
          <p className="text-xs text-zinc-500 mb-4">
            {selectedProblems.length} of {allProblems.length} problems selected.
          </p>

          {problemSuccess && <div className="mb-4"><SuccessBanner message={problemSuccess} /></div>}

          <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950 p-2.5 mb-4">
            {allProblems.length === 0 ? (
              <p className="p-2 text-xs text-zinc-500">No problems available. Create problems first.</p>
            ) : (
              allProblems.map((p) => {
                const checked = selectedProblems.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-2.5 rounded p-2 text-xs transition hover:bg-zinc-900 ${
                      checked ? "bg-zinc-900/60" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProblem(p.id)}
                      className="rounded border-zinc-700 bg-zinc-900 accent-zinc-100"
                    />
                    <span className="font-medium text-zinc-200 flex-1">{p.title}</span>
                    <DifficultyBadge difficulty={p.difficulty} />
                  </label>
                );
              })
            )}
          </div>

          <button
            onClick={handleSaveProblems}
            disabled={savingProblems}
            className="w-full rounded-md bg-zinc-100 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition disabled:opacity-50"
          >
            {savingProblems ? "Updating..." : "Update Problem Set"}
          </button>
        </div>
      </div>
    </div>
  );
}

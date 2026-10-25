"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetchSafe, apiFetch, getAuthToken, API_BASE_URL } from "@/lib/api";
import type { ContestDetail, Problem } from "@/lib/types";
import { LoadingSpinner, ErrorBanner, SuccessBanner } from "@/components/admin/AdminUI";

export default function AdminEditContestPage() {
  const params = useParams();
  const router = useRouter();
  const contestId = (params?.id as string) || "";

  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  async function loadData() {
    const [cData, pData] = await Promise.all([
      apiFetchSafe<ContestDetail>(`/contests/${contestId}`),
      apiFetchSafe<Problem[]>("/problems"),
    ]);
    if (cData) {
      setContest(cData);
      setTitle(cData.title);
      setDescription(cData.description);
      // Format datetime-local: YYYY-MM-DDTHH:mm
      const fmtLocal = (iso: string) => {
        const d = new Date(iso);
        const off = d.getTimezoneOffset();
        return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
      };
      setStartTime(fmtLocal(cData.startTime));
      setEndTime(fmtLocal(cData.endTime));
    }
    if (pData) setProblems(pData);
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
      // Backend does not have PUT /admin/contests/{id} yet — document as missing
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
      setSuccess("Contest updated successfully.");
      setTimeout(() => router.push(`/admin/contests/${contestId}`), 1500);
    } catch (err: any) {
      setError(err.message || "Failed to update contest. The backend may not support PUT /admin/contests/{id} yet.");
    } finally {
      setSaving(false);
    }
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
      <p className="mt-1.5 text-xs text-zinc-400">Update contest details and schedule.</p>

      <div className="mt-8 max-w-3xl rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        {success && <div className="mb-4"><SuccessBanner message={success} /></div>}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Contest ID</label>
            <input
              type="text" disabled value={contest.id}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs font-mono text-zinc-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Title</label>
            <input
              type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Description</label>
            <textarea
              required rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
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

          {/* Note about problems */}
          <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-3">
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              <span className="font-mono text-zinc-400">Note:</span> Problem management (add/remove) for an existing contest requires a backend endpoint (PUT /admin/contests/{`{id}`}/problems). This is documented as a missing backend feature.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit" disabled={saving}
              className="rounded-md bg-zinc-100 px-5 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
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
    </div>
  );
}

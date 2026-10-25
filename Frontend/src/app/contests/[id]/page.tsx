"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import { API_BASE_URL } from "@/lib/api";

interface ContestProblem {
  id: string;
  title: string;
  difficulty: string;
  points: number;
}

interface ContestDetail {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  problems: ContestProblem[];
}

interface StandingUser {
  rank: number;
  userId: string;
  username: string;
  problems_solved: number;
  total_points: number;
  total_penalty_minutes: number;
  problem_results: Record<string, { solved: boolean; attempts: number; solved_at?: number }>;
}

export default function ContestArenaPage() {
  const routeParams = useParams();
  const contestId = (routeParams?.id as string) || "";

  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [standings, setStandings] = useState<StandingUser[]>([]);
  const [activeTab, setActiveTab] = useState<"problems" | "standings" | "rules">("problems");
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [contestStatus, setContestStatus] = useState<"UPCOMING" | "LIVE" | "ENDED">("LIVE");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadContestData() {
      try {
        const [contestRes, standingsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/contests/${contestId}`),
          fetch(`${API_BASE_URL}/contests/${contestId}/leaderboard`),
        ]);

        if (contestRes.ok) {
          const cData = await contestRes.json();
          setContest(cData);
        }

        if (standingsRes.ok) {
          const sData = await standingsRes.json();
          if (sData.standings) {
            setStandings(sData.standings);
          }
        }
      } catch {
        // Fallback demo data
        setContest({
          id: contestId,
          title: "TIC Weekly Contest #1",
          description: "Solve 2 algorithmic challenges within the round window. Fast submissions with minimal attempts rank highest.",
          startTime: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
          endTime: new Date(Date.now() + 1000 * 60 * 65).toISOString(),
          problems: [
            { id: "two-sum", title: "Two Sum", difficulty: "Easy", points: 100 },
            { id: "reverse-string", title: "Reverse String", difficulty: "Easy", points: 100 },
          ],
        });
        setStandings([
          {
            rank: 1,
            userId: "u-1",
            username: "sumit.coder",
            problems_solved: 2,
            total_points: 200,
            total_penalty_minutes: 42,
            problem_results: {
              "two-sum": { solved: true, attempts: 1 },
              "reverse-string": { solved: true, attempts: 1 },
            },
          },
          {
            rank: 2,
            userId: "u-2",
            username: "mansi.dev",
            problems_solved: 1,
            total_points: 100,
            total_penalty_minutes: 18,
            problem_results: {
              "two-sum": { solved: true, attempts: 2 },
            },
          },
        ]);
      } finally {
        setLoading(false);
      }
    }

    loadContestData();
  }, [contestId]);

  // Countdown timer calculation
  useEffect(() => {
    if (!contest) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const start = new Date(contest.startTime).getTime();
      const end = new Date(contest.endTime).getTime();

      if (now < start) {
        setContestStatus("UPCOMING");
        const diff = Math.max(0, start - now);
        setTimeLeft({
          hours: Math.floor(diff / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        });
      } else if (now >= start && now <= end) {
        setContestStatus("LIVE");
        const diff = Math.max(0, end - now);
        setTimeLeft({
          hours: Math.floor(diff / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        });
      } else {
        setContestStatus("ENDED");
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [contest]);

  return (
    <AuthGuard>
      <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-zinc-100">
      <Navbar />

      <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6">
          <Link href="/contests" className="hover:text-zinc-300 transition">
            Contests
          </Link>
          <span>/</span>
          <span className="text-zinc-300 font-mono">{contestId}</span>
        </div>

        {/* Contest Header & Timer Banner */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6 lg:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wide border ${
                    contestStatus === "LIVE"
                      ? "border-emerald-900/50 bg-emerald-950/20 text-emerald-400"
                      : contestStatus === "UPCOMING"
                      ? "border-zinc-800 bg-zinc-900 text-zinc-300"
                      : "border-zinc-800 bg-zinc-950 text-zinc-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      contestStatus === "LIVE" ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                    }`}
                  />
                  {contestStatus === "LIVE" ? "Live Round" : contestStatus === "UPCOMING" ? "Upcoming" : "Concluded"}
                </span>
                <span className="text-xs font-mono text-zinc-500">ID: {contestId}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
                {contest?.title || "Contest Arena"}
              </h1>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400 max-w-2xl">
                {contest?.description}
              </p>
            </div>

            {/* Countdown Box */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-center shrink-0 min-w-[200px]">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {contestStatus === "LIVE"
                  ? "Round Ends In"
                  : contestStatus === "UPCOMING"
                  ? "Starts In"
                  : "Round Finished"}
              </p>

              {timeLeft && contestStatus !== "ENDED" ? (
                <div className="mt-1 flex items-center justify-center gap-1.5 font-mono text-2xl font-semibold text-zinc-100">
                  <span>{String(timeLeft.hours).padStart(2, "0")}h</span>
                  <span className="text-zinc-600">:</span>
                  <span>{String(timeLeft.minutes).padStart(2, "0")}m</span>
                  <span className="text-zinc-600">:</span>
                  <span>{String(timeLeft.seconds).padStart(2, "0")}s</span>
                </div>
              ) : (
                <p className="mt-1 font-mono text-lg font-medium text-zinc-500">00:00:00</p>
              )}

              <p className="mt-1 text-[10px] text-zinc-600">
                {contestStatus === "LIVE" ? "Automatic lock at zero" : "Synchronized timer"}
              </p>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="mt-8 flex gap-2 border-t border-zinc-800/60 pt-4">
            <button
              onClick={() => setActiveTab("problems")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                activeTab === "problems"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Problem Set ({contest?.problems?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("standings")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                activeTab === "standings"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Live Standings
            </button>
            <button
              onClick={() => setActiveTab("rules")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                activeTab === "rules"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Rules & Scoring
            </button>
          </div>
        </div>

        {/* TAB 1: Problems List */}
        {activeTab === "problems" && (
          <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 border-b border-zinc-800/80 px-6 py-3 text-[11px] font-mono uppercase text-zinc-500">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-6 md:col-span-7">Title</div>
              <div className="col-span-2">Points</div>
              <div className="col-span-3 text-right">Action</div>
            </div>

            <div className="divide-y divide-zinc-800/60">
              {contest?.problems && contest.problems.length > 0 ? (
                contest.problems.map((p, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  return (
                    <div
                      key={p.id}
                      className="grid grid-cols-12 items-center gap-4 px-6 py-3.5 text-xs hover:bg-zinc-900/40 transition"
                    >
                      <div className="col-span-1 text-center font-mono font-bold text-zinc-300">
                        {letter}
                      </div>
                      <div className="col-span-6 md:col-span-7">
                        <Link
                          href={`/contests/${contestId}/problems/${p.id}`}
                          className="font-medium text-zinc-200 hover:text-zinc-100 transition"
                        >
                          {p.title}
                        </Link>
                        <span
                          className={`ml-2.5 text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                            p.difficulty === "Easy"
                              ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/40"
                              : p.difficulty === "Medium"
                              ? "bg-amber-950/30 text-amber-400 border-amber-900/40"
                              : "bg-red-950/30 text-red-400 border-red-900/40"
                          }`}
                        >
                          {p.difficulty}
                        </span>
                      </div>
                      <div className="col-span-2 font-mono text-zinc-400">
                        {p.points || 100} pts
                      </div>
                      <div className="col-span-3 text-right">
                        <Link
                          href={`/contests/${contestId}/problems/${p.id}`}
                          className="inline-flex rounded bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
                        >
                          Solve Challenge →
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-zinc-500">
                  No problems registered for this contest yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Standings */}
        {activeTab === "standings" && (
          <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 border-b border-zinc-800/80 px-6 py-3 text-[11px] font-mono uppercase text-zinc-500">
              <div className="col-span-1 text-center">Rank</div>
              <div className="col-span-5 md:col-span-6">User</div>
              <div className="col-span-2 text-center">Solved</div>
              <div className="col-span-2 text-center">Penalty</div>
              <div className="col-span-2 text-right">Score</div>
            </div>

            <div className="divide-y divide-zinc-800/60">
              {standings.length > 0 ? (
                standings.map((u) => (
                  <div
                    key={u.userId}
                    className="grid grid-cols-12 items-center gap-4 px-6 py-3.5 text-xs hover:bg-zinc-900/40 transition font-mono"
                  >
                    <div className="col-span-1 text-center font-bold text-zinc-300">
                      #{u.rank}
                    </div>
                    <div className="col-span-5 md:col-span-6 font-sans font-medium text-zinc-200 truncate">
                      {u.username}
                    </div>
                    <div className="col-span-2 text-center font-semibold text-zinc-300">
                      {u.problems_solved} / {contest?.problems.length || 0}
                    </div>
                    <div className="col-span-2 text-center text-zinc-400">
                      {u.total_penalty_minutes} min
                    </div>
                    <div className="col-span-2 text-right font-bold text-zinc-100">
                      {u.total_points}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-zinc-500">
                  No submissions recorded yet for this round.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Rules */}
        {activeTab === "rules" && (
          <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6 space-y-4 text-xs text-zinc-400 leading-relaxed">
            <h3 className="text-sm font-semibold text-zinc-200">ICPC Scoring Regulations</h3>
            <p>
              Rankings are determined primarily by the total number of problems solved. Ties are broken by the total penalty time.
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
              <li>Penalty time for a problem is the time in minutes from the contest start until the first accepted submission.</li>
              <li>Each rejected submission before the first accepted run adds 20 penalty minutes.</li>
              <li>Rejected runs on unsolved problems do not count toward penalty.</li>
            </ul>
          </div>
        )}
      </div>
    </main>
  </AuthGuard>
  );
}

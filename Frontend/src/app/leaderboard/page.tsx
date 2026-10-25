"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
<<<<<<< HEAD
=======
import { API_BASE_URL } from "@/lib/api";
>>>>>>> vaidehi-local

interface LeaderboardUser {
  rank: number;
  userId: string;
  username: string;
  accepted_count: number;
}

const DEFAULT_LEADERBOARD: LeaderboardUser[] = [
  { rank: 1, userId: "u-1", username: "sumit.coder", accepted_count: 14 },
  { rank: 2, userId: "u-2", username: "mansi.dev", accepted_count: 12 },
  { rank: 3, userId: "u-3", username: "abhi.algo", accepted_count: 9 },
  { rank: 4, userId: "u-4", username: "yash.cloud", accepted_count: 7 },
  { rank: 5, userId: "u-5", username: "priya.tech", accepted_count: 5 },
  { rank: 6, userId: "u-6", username: "rohit.kernel", accepted_count: 4 },
];

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>(DEFAULT_LEADERBOARD);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
<<<<<<< HEAD
        const res = await fetch("http://localhost:8000/leaderboard", { cache: "no-store" });
=======
        const res = await fetch(`${API_BASE_URL}/leaderboard`, { cache: "no-store" });
>>>>>>> vaidehi-local
        if (res.ok) {
          const data = await res.json();
          if (data.leaderboard && data.leaderboard.length > 0) {
            setLeaderboard(data.leaderboard);
          }
        }
      } catch {
        // use fallback default
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, []);

  return (
    <AuthGuard>
      <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-zinc-100">
        <Navbar />

      <div className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
        {/* Header */}
        <div className="pb-8 border-b border-zinc-800/80">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-0.5 text-[11px] font-mono text-zinc-400">
            Campus Standings
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
            Global Standings
          </h1>
          <p className="mt-1.5 text-xs text-zinc-400 max-w-xl leading-relaxed">
            Real-time rankings based on automated test evaluations across all practice challenges and live rounds.
          </p>
        </div>

        {/* Top 3 Summary Cards */}
        {leaderboard.length >= 3 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Rank 2 */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/20 p-5">
              <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
                <span>Rank 2</span>
                <span>Silver</span>
              </div>
              <p className="mt-3 text-base font-semibold text-zinc-200 truncate">
                {leaderboard[1].username}
              </p>
              <p className="mt-1 text-xs text-zinc-400 font-mono">
                {leaderboard[1].accepted_count} Accepted Solves
              </p>
            </div>

            {/* Rank 1 */}
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-5 relative">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                <span className="text-zinc-200 font-semibold">Rank 1 · Top Performer</span>
                <span>Leader</span>
              </div>
              <p className="mt-3 text-base font-semibold text-zinc-100 truncate">
                {leaderboard[0].username}
              </p>
              <p className="mt-1 text-xs text-zinc-300 font-mono">
                {leaderboard[0].accepted_count} Accepted Solves
              </p>
            </div>

            {/* Rank 3 */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/20 p-5">
              <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
                <span>Rank 3</span>
                <span>Bronze</span>
              </div>
              <p className="mt-3 text-base font-semibold text-zinc-200 truncate">
                {leaderboard[2].username}
              </p>
              <p className="mt-1 text-xs text-zinc-400 font-mono">
                {leaderboard[2].accepted_count} Accepted Solves
              </p>
            </div>
          </div>
        )}

        {/* Standings Table */}
        <div className="mt-8 rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 border-b border-zinc-800/80 px-6 py-3 text-[11px] font-mono uppercase text-zinc-500">
            <div className="col-span-2 text-center">Rank</div>
            <div className="col-span-7">Student Handle</div>
            <div className="col-span-3 text-right">Problems Solved</div>
          </div>

          <div className="divide-y divide-zinc-800/60">
            {leaderboard.map((u) => (
              <div
                key={u.userId}
                className="grid grid-cols-12 items-center gap-4 px-6 py-3.5 text-xs hover:bg-zinc-900/40 transition"
              >
                <div className="col-span-2 text-center font-mono font-medium text-zinc-400">
                  #{u.rank}
                </div>
                <div className="col-span-7 font-medium text-zinc-200 truncate">
                  {u.username}
                </div>
                <div className="col-span-3 text-right font-mono font-semibold text-zinc-300">
                  {u.accepted_count}
                </div>
              </div>
            ))}
          </div>
        </div>
<<<<<<< HEAD
=======
      </div>
>>>>>>> vaidehi-local
      </main>
    </AuthGuard>
  );
}

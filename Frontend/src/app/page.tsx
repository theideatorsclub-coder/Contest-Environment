"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { API_BASE_URL } from "@/lib/api";

interface ContestPreview {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  status: "UPCOMING" | "LIVE" | "ENDED";
  problem_count: number;
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [featuredContest, setFeaturedContest] = useState<ContestPreview | null>(null);
  const [countdown, setCountdown] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const checkUser = () => {
      const stored = localStorage.getItem("tic_user");
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    };

    checkUser();
    window.addEventListener("storage", checkUser);
    window.addEventListener("auth-change", checkUser);
    return () => {
      window.removeEventListener("storage", checkUser);
      window.removeEventListener("auth-change", checkUser);
    };
  }, []);

  const handleActionClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent("open-auth-modal", { detail: { role: "STUDENT" } })
      );
    }
  };

  useEffect(() => {
    async function fetchContest() {
      try {
        const res = await fetch(`${API_BASE_URL}/contests`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setFeaturedContest(data[0]);
          }
        }
      } catch {
        setFeaturedContest({
          id: "tic-weekly-1",
          title: "TIC Weekly Contest #1",
          description: "Solve 3 algorithmic challenges within 90 minutes. Submissions evaluated against automated test cases.",
          startTime: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          endTime: new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString(),
          status: "UPCOMING",
          problem_count: 3,
        });
      }
    }

    fetchContest();
  }, []);

  useEffect(() => {
    if (!featuredContest) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const target =
        featuredContest.status === "LIVE"
          ? new Date(featuredContest.endTime).getTime()
          : new Date(featuredContest.startTime).getTime();

      const diff = Math.max(0, target - now);
      setCountdown({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [featuredContest]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-zinc-800 selection:text-zinc-100">
      <Navbar />

      {/* Hero */}
      <section className="relative border-b border-zinc-900 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Content */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                The Ideators Club · Contest Arena
              </div>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl text-zinc-100">
                Synchronized college coding rounds.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400">
                A dedicated contest platform for students. Solve algorithmic challenges under 
                time constraints with automated test evaluations and real-time standings.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/contests"
                  onClick={handleActionClick}
                  className="rounded-lg bg-zinc-100 px-5 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-300"
                >
                  Enter Contest Arena →
                </Link>
                <Link
                  href="/leaderboard"
                  onClick={handleActionClick}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-5 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
                >
                  View Standings
                </Link>
              </div>

              <div className="mt-12 grid grid-cols-3 gap-6 border-t border-zinc-900 pt-6 max-w-md">
                <div>
                  <p className="font-mono text-xl font-semibold text-zinc-200">90 min</p>
                  <p className="mt-1 text-xs text-zinc-500">Round Duration</p>
                </div>
                <div>
                  <p className="font-mono text-xl font-semibold text-zinc-200">ACM Style</p>
                  <p className="mt-1 text-xs text-zinc-500">Scoring & Penalty</p>
                </div>
                <div>
                  <p className="font-mono text-xl font-semibold text-zinc-200">Judge0</p>
                  <p className="mt-1 text-xs text-zinc-500">Grading Engine</p>
                </div>
              </div>
            </div>

            {/* Right Featured Round Card */}
            <div className="lg:col-span-5">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        featuredContest?.status === "LIVE" ? "bg-emerald-500 animate-pulse" : "bg-blue-500"
                      }`}
                    />
                    <span className="text-xs font-medium text-zinc-300">
                      {featuredContest?.status === "LIVE" ? "Live Round" : "Upcoming Round"}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-zinc-500">
                    {featuredContest?.problem_count || 3} Problems
                  </span>
                </div>

                <div className="mt-5">
                  <h3 className="text-lg font-semibold text-zinc-100">
                    {featuredContest?.title || "TIC Weekly Contest #1"}
                  </h3>
                  <p className="mt-2 text-xs text-zinc-400 leading-relaxed line-clamp-2">
                    {featuredContest?.description || "Solve 3 algorithmic challenges within 90 minutes."}
                  </p>
                </div>

                {/* Digital Countdown Timer */}
                <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    {featuredContest?.status === "LIVE" ? "Round Ends In" : "Starts In"}
                  </p>

                  {countdown ? (
                    <div className="mt-2 flex items-center justify-center gap-2 font-mono text-2xl font-semibold text-zinc-100">
                      <span>{String(countdown.hours).padStart(2, "0")}</span>
                      <span className="text-zinc-600">:</span>
                      <span>{String(countdown.minutes).padStart(2, "0")}</span>
                      <span className="text-zinc-600">:</span>
                      <span>{String(countdown.seconds).padStart(2, "0")}</span>
                    </div>
                  ) : (
                    <p className="mt-2 font-mono text-lg text-zinc-400">00:00:00</p>
                  )}
                </div>

                <div className="mt-5 flex flex-col gap-2">
                  <Link
                    href={featuredContest ? `/contests/${featuredContest.id}` : "/contests"}
                    onClick={handleActionClick}
                    className="w-full rounded-md bg-zinc-100 py-2.5 text-center text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200"
                  >
                    Open Contest Arena →
                  </Link>
                  <Link
                    href="/leaderboard"
                    onClick={handleActionClick}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-2.5 text-center text-xs font-medium text-zinc-400 transition hover:text-zinc-200 hover:bg-zinc-800"
                  >
                    Campus Standings
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three Pillars Section */}
      <section className="py-20 border-b border-zinc-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/20 p-6">
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">01 / Execution</span>
              <h3 className="mt-3 text-sm font-semibold text-zinc-200">Synchronized Timers</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Problems unlock precisely at round start. Submissions close automatically when the countdown expires.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/20 p-6">
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">02 / Evaluation</span>
              <h3 className="mt-3 text-sm font-semibold text-zinc-200">Automated Grading</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Code is tested against rigorous hidden test suites. Output is compared with normalized spacing and strict time bounds.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/20 p-6">
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">03 / Standings</span>
              <h3 className="mt-3 text-sm font-semibold text-zinc-200">ICPC-Style Scoring</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Rankings balance speed and precision. Each wrong submission adds 20 penalty minutes to your problem finish time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-zinc-500">
        <div className="flex items-center justify-center gap-2 mb-1 text-zinc-400">
          <span>TIC Contest</span>
          <span>·</span>
          <span>The Ideators Club</span>
        </div>
        <p className="text-[11px] text-zinc-600">Competitive programming platform for college students.</p>
      </footer>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: "ADMIN" | "STUDENT";
}

export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const [user, setUser] = useState<any>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
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
      setChecked(true);
    };

    checkAuth();
    window.addEventListener("storage", checkAuth);
    window.addEventListener("auth-change", checkAuth);

    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("auth-change", checkAuth);
    };
  }, []);

  // When not signed in, pop modal automatically on first mount
  useEffect(() => {
    if (checked && !user) {
      window.dispatchEvent(
        new CustomEvent("open-auth-modal", {
          detail: { role: requiredRole || "STUDENT" },
        })
      );
    }
  }, [checked, user, requiredRole]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-mono text-xs text-zinc-500">
        Authenticating...
      </div>
    );
  }

  // Not signed in at all
  if (!user) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-zinc-100">
        <Navbar />
        <div className="mx-auto max-w-md px-6 py-28 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-mono text-zinc-400 mb-6">
            AUTH
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Sign In Required
          </h1>
          <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed">
            All contest features, problems, coding workspaces, and rankings are restricted to verified accounts. Please sign in to continue.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("open-auth-modal", { detail: { role: "STUDENT" } })
                )
              }
              className="w-full sm:w-auto rounded-md bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
            >
              Sign In as Student
            </button>
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("open-auth-modal", { detail: { role: "ADMIN" } })
                )
              }
              className="w-full sm:w-auto rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
            >
              Admin Login
            </button>
          </div>

          <p className="mt-8 text-[11px] text-zinc-600 font-mono">
            Demo credentials available: student@tic.edu or admin@tic.edu
          </p>
        </div>
      </main>
    );
  }

  // Required Admin role check
  if (requiredRole === "ADMIN" && user.role !== "ADMIN") {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-zinc-100">
        <Navbar />
        <div className="mx-auto max-w-md px-6 py-28 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-mono text-zinc-400 mb-6">
            SEC
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Admin Access Required
          </h1>
          <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed">
            You are signed in as <span className="font-mono text-zinc-200">{user.email}</span> (Student). The Admin Console requires verified Faculty or Club Administrator privileges.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("open-auth-modal", { detail: { role: "ADMIN" } })
                )
              }
              className="w-full sm:w-auto rounded-md bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
            >
              Switch to Admin Login
            </button>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

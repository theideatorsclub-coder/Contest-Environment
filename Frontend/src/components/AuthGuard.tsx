"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getCurrentUser } from "@/lib/api";
import type { UserPayload } from "@/lib/api";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: "ADMIN" | "STUDENT";
}

export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = () => {
      setUser(getCurrentUser());
      setChecked(true);
    };

    check();
    window.addEventListener("storage", check);
    window.addEventListener("auth-change", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("auth-change", check);
    };
  }, []);

  // Auto-open auth modal when not signed in
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center font-mono text-xs text-zinc-500">
        Authenticating…
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <Navbar />
        <div className="mx-auto max-w-md px-6 py-28 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-mono text-zinc-400 mb-6">
            AUTH
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Sign In Required</h1>
          <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
            Contest features, problems, and rankings require a verified account. Please sign in to continue.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() =>
                window.dispatchEvent(new CustomEvent("open-auth-modal", { detail: { role: "STUDENT" } }))
              }
              className="w-full sm:w-auto rounded-md bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
            >
              Sign In as Student
            </button>
            <button
              onClick={() =>
                window.dispatchEvent(new CustomEvent("open-auth-modal", { detail: { role: "ADMIN" } }))
              }
              className="w-full sm:w-auto rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
            >
              Admin Login
            </button>
          </div>
          <p className="mt-6 text-[11px] text-zinc-600 font-mono">
            Demo: student@tic.edu / student123
          </p>
        </div>
      </main>
    );
  }

  // Signed in as wrong role
  if (requiredRole === "ADMIN" && user.role !== "ADMIN") {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <Navbar />
        <div className="mx-auto max-w-md px-6 py-28 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-mono text-zinc-400 mb-6">
            SEC
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Admin Access Required</h1>
          <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed">
            Signed in as <span className="font-mono text-zinc-200">{user.email}</span> (Student).
            This page requires administrator privileges.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() =>
                window.dispatchEvent(new CustomEvent("open-auth-modal", { detail: { role: "ADMIN" } }))
              }
              className="w-full sm:w-auto rounded-md bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
            >
              Switch to Admin Login
            </button>
            <Link
              href="/contests"
              className="w-full sm:w-auto rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
            >
              Go to Contests
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

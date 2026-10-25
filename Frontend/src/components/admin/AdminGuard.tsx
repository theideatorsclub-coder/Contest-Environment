"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getCurrentUser, UserPayload } from "@/lib/api";

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * Guards admin routes: requires logged-in user with role ADMIN.
 * Renders the navbar + sidebar layout for all admin pages.
 */
export default function AdminGuard({ children }: AdminGuardProps) {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      setUser(getCurrentUser());
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

  useEffect(() => {
    if (checked && !user) {
      window.dispatchEvent(
        new CustomEvent("open-auth-modal", { detail: { role: "ADMIN" } })
      );
    }
  }, [checked, user]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 font-mono text-xs text-zinc-500">
        Authenticating...
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <Navbar />
        <div className="mx-auto max-w-md px-6 py-28 text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-mono text-zinc-400">
            AUTH
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Sign In Required
          </h1>
          <p className="mt-2.5 text-xs leading-relaxed text-zinc-400">
            Admin access requires verified administrator credentials. Please sign in to continue.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("open-auth-modal", { detail: { role: "ADMIN" } })
                )
              }
              className="w-full rounded-md bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition sm:w-auto"
            >
              Sign In as Admin
            </button>
            <Link
              href="/"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition sm:w-auto"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (user.role !== "ADMIN") {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <Navbar />
        <div className="mx-auto max-w-md px-6 py-28 text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-mono text-zinc-400">
            SEC
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Admin Access Required
          </h1>
          <p className="mt-2.5 text-xs leading-relaxed text-zinc-400">
            You are signed in as{" "}
            <span className="font-mono text-zinc-200">{user.email}</span> (Student).
            The Admin Console requires administrator privileges.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("open-auth-modal", { detail: { role: "ADMIN" } })
                )
              }
              className="w-full rounded-md bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition sm:w-auto"
            >
              Switch to Admin Login
            </button>
            <Link
              href="/contests"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition sm:w-auto"
            >
              Return to Contests
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <Navbar />
      <AdminSidebar />
      <div className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
          {children}
        </div>
      </div>
    </main>
  );
}

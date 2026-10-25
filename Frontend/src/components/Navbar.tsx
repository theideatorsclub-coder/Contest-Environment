"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

export interface UserState {
  email: string;
  userId: string;
  name: string;
  role: "ADMIN" | "STUDENT" | string;
}

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserState | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loginRoleMode, setLoginRoleMode] = useState<"STUDENT" | "ADMIN">("STUDENT");
  const [email, setEmail] = useState("student@tic.edu");
  const [password, setPassword] = useState("student123");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    checkUser();
    window.addEventListener("storage", checkUser);
    window.addEventListener("auth-change", checkUser);

    const handleOpenAuth = (e: any) => {
      const targetRole = e.detail?.role || "STUDENT";
      handleSelectRole(targetRole);
      setShowAuthModal(true);
    };

    window.addEventListener("open-auth-modal", handleOpenAuth);

    return () => {
      window.removeEventListener("storage", checkUser);
      window.removeEventListener("auth-change", checkUser);
      window.removeEventListener("open-auth-modal", handleOpenAuth);
    };
  }, []);

  const handleSelectRole = (role: "STUDENT" | "ADMIN") => {
    setLoginRoleMode(role);
    setAuthError("");
    if (role === "ADMIN") {
      setEmail("admin@tic.edu");
      setPassword("admin123");
    } else {
      setEmail("student@tic.edu");
      setPassword("student123");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError("");

    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("tic_token", data.access_token);
        const userData: UserState = {
          email: data.email,
          userId: data.user_id,
          name: data.name || data.email.split("@")[0],
          role: data.role || loginRoleMode,
        };
        localStorage.setItem("tic_user", JSON.stringify(userData));
        setUser(userData);
        setShowAuthModal(false);
        window.dispatchEvent(new Event("auth-change"));
        return;
      }

      // If backend responded with error
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Invalid email or credentials");
    } catch (err: any) {
      // If server is offline during development/preview, offer mock sign-in
      if (err.message?.includes("fetch") || err.message?.includes("connect") || err.message?.includes("Network")) {
        const fallbackUser: UserState = {
          email: email.trim(),
          userId: loginRoleMode === "ADMIN" ? "admin-demo-1" : "student-demo-1",
          name: loginRoleMode === "ADMIN" ? "Club Administrator" : "Student Contestant",
          role: loginRoleMode,
        };
        localStorage.setItem("tic_token", "demo_local_token");
        localStorage.setItem("tic_user", JSON.stringify(fallbackUser));
        setUser(fallbackUser);
        setShowAuthModal(false);
        window.dispatchEvent(new Event("auth-change"));
        return;
      }
      setAuthError(err.message || "Authentication failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("tic_token");
    localStorage.removeItem("tic_user");
    setUser(null);
    window.dispatchEvent(new Event("auth-change"));
  };

  const navLinks = [
    { label: "Contests", href: "/contests" },
    { label: "Problems", href: "/problems" },
    { label: "Standings", href: "/leaderboard" },
    ...(user?.role === "ADMIN" ? [{ label: "Admin Console", href: "/admin", isAdmin: true }] : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-50 h-14 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md">
        <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-5 lg:px-8">
          {/* Brand */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-100 text-xs font-bold text-zinc-950 transition group-hover:bg-white">
                T
              </span>
              <span className="text-sm font-semibold tracking-tight text-zinc-100">
                TIC Contest
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden items-center gap-6 text-xs font-medium text-zinc-400 sm:flex">
              {navLinks.map((link) => {
                const active = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={(e) => {
                      if (!user) {
                        e.preventDefault();
                        handleSelectRole(link.isAdmin ? "ADMIN" : "STUDENT");
                        setShowAuthModal(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 transition-colors ${
                      active ? "text-zinc-100" : "hover:text-zinc-200"
                    }`}
                  >
                    <span>{link.label}</span>
                    {link.isAdmin && (
                      <span className="rounded bg-zinc-800 px-1 py-0.2 text-[9px] font-mono text-zinc-300 uppercase">
                        Admin
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right Action / User State */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-300 font-medium hidden md:inline">
                    {user.name || user.email}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono tracking-wide uppercase border ${
                      user.role === "ADMIN"
                        ? "bg-zinc-800 text-zinc-200 border-zinc-700"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800"
                    }`}
                  >
                    {user.role === "ADMIN" ? "Admin" : "Student"}
                  </span>
                </div>

                {/* Quick Role Switcher for Testing */}
                <button
                  onClick={() => {
                    handleSelectRole(user.role === "ADMIN" ? "STUDENT" : "ADMIN");
                    setShowAuthModal(true);
                  }}
                  title="Switch to other role"
                  className="hidden sm:inline-block text-[11px] text-zinc-500 hover:text-zinc-300 transition"
                >
                  Switch role
                </button>

                <button
                  onClick={handleLogout}
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleSelectRole("STUDENT");
                    setShowAuthModal(true);
                  }}
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition"
                >
                  Student Login
                </button>
                <button
                  onClick={() => {
                    handleSelectRole("ADMIN");
                    setShowAuthModal(true);
                  }}
                  className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
                >
                  Admin Login
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Minimal Clean Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-200 text-xs"
            >
              ✕
            </button>

            {/* Segmented Role Switcher */}
            <div className="flex rounded-lg bg-zinc-950 p-1 mb-5 border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => handleSelectRole("STUDENT")}
                className={`flex-1 py-1.5 font-medium rounded transition ${
                  loginRoleMode === "STUDENT"
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Student Access
              </button>
              <button
                type="button"
                onClick={() => handleSelectRole("ADMIN")}
                className={`flex-1 py-1.5 font-medium rounded transition ${
                  loginRoleMode === "ADMIN"
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Admin Console
              </button>
            </div>

            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                {loginRoleMode === "ADMIN" ? "Admin Authentication" : "Student Sign In"}
              </h2>
              <p className="text-xs text-zinc-400 mt-1 mb-4 leading-relaxed">
                {loginRoleMode === "ADMIN"
                  ? "Access contest creation, problem authoring, and testcase configuration."
                  : "Solve challenges, join live synchronized rounds, and view campus ranks."}
              </p>
            </div>

            {authError && (
              <div className="mb-4 rounded-md bg-red-950/40 border border-red-800/40 p-2.5 text-xs text-red-300">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@tic.edu"
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-zinc-100 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition disabled:opacity-50 mt-1"
              >
                {loading ? "Authenticating..." : `Sign In as ${loginRoleMode === "ADMIN" ? "Admin" : "Student"}`}
              </button>

              <div className="rounded-md bg-zinc-950 border border-zinc-800/80 p-2.5 text-center text-[11px] text-zinc-500">
                <span className="text-zinc-500">Demo preset: </span>
                <span className="font-mono text-zinc-400">
                  {loginRoleMode === "ADMIN" ? "admin@tic.edu / admin123" : "student@tic.edu / student123"}
                </span>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

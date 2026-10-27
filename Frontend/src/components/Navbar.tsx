"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
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
  const [authLoading, setAuthLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Keep a ref to the latest loginRoleMode to avoid stale closures in event handlers
  const loginRoleModeRef = useRef(loginRoleMode);
  useEffect(() => { loginRoleModeRef.current = loginRoleMode; }, [loginRoleMode]);

  const checkUser = useCallback(() => {
    const stored = localStorage.getItem("tic_user");
    if (stored) {
      try { setUser(JSON.parse(stored)); }
      catch { setUser(null); }
    } else {
      setUser(null);
    }
  }, []);

  const handleSelectRole = useCallback((role: "STUDENT" | "ADMIN") => {
    setLoginRoleMode(role);
    setAuthError("");
    setEmail(role === "ADMIN" ? "admin@tic.edu" : "student@tic.edu");
    setPassword(role === "ADMIN" ? "admin123" : "student123");
  }, []);

  useEffect(() => {
    checkUser();
    window.addEventListener("storage", checkUser);
    window.addEventListener("auth-change", checkUser);

    const handleOpenAuth = (e: Event) => {
      const role = (e as CustomEvent).detail?.role || "STUDENT";
      handleSelectRole(role);
      setShowAuthModal(true);
    };
    window.addEventListener("open-auth-modal", handleOpenAuth);

    return () => {
      window.removeEventListener("storage", checkUser);
      window.removeEventListener("auth-change", checkUser);
      window.removeEventListener("open-auth-modal", handleOpenAuth);
    };
  }, [checkUser, handleSelectRole]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "Invalid email or password.");
      }

      // Validate that the role matches what was selected
      const serverRole: string = data.role || "STUDENT";
      if (loginRoleMode === "ADMIN" && serverRole !== "ADMIN") {
        throw new Error("This account does not have admin privileges.");
      }

      localStorage.setItem("tic_token", data.access_token);
      const userData: UserState = {
        email: data.email,
        userId: data.user_id,
        name: data.name || data.email.split("@")[0],
        role: serverRole,
      };
      localStorage.setItem("tic_user", JSON.stringify(userData));
      setUser(userData);
      setShowAuthModal(false);
      setMobileMenuOpen(false);
      window.dispatchEvent(new Event("auth-change"));
    } catch (err: any) {
      const msg: string = err.message || "";
      // Distinguish network errors from credential errors
      if (
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("ERR_CONNECTION_REFUSED") ||
        msg.includes("net::") ||
        msg.includes("fetch")
      ) {
        setAuthError("Cannot reach the server. Make sure the backend is running at " + API_BASE_URL + ".");
      } else {
        setAuthError(msg || "Authentication failed. Check your credentials.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("tic_token");
    localStorage.removeItem("tic_user");
    setUser(null);
    setMobileMenuOpen(false);
    window.dispatchEvent(new Event("auth-change"));
  };

  const navLinks = [
    { label: "Contests", href: "/contests" },
    { label: "Problems", href: "/problems" },
    { label: "Standings", href: "/leaderboard" },
    ...(user?.role === "ADMIN" ? [{ label: "Admin", href: "/admin", isAdmin: true }] : []),
  ];

  const handleNavClick = (e: React.MouseEvent, isAdmin?: boolean) => {
    if (!user) {
      e.preventDefault();
      handleSelectRole(isAdmin ? "ADMIN" : "STUDENT");
      setShowAuthModal(true);
    }
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 h-14 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-5 lg:px-8">

          {/* Brand */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group" onClick={() => setMobileMenuOpen(false)}>
              <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-100 text-xs font-bold text-zinc-950 transition group-hover:bg-white">
                T
              </span>
              <span className="text-sm font-semibold tracking-tight text-zinc-100">TIC Contest</span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden items-center gap-6 text-xs font-medium text-zinc-400 sm:flex">
              {navLinks.map((link) => {
                const active = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.isAdmin)}
                    className={`flex items-center gap-1.5 transition-colors ${active ? "text-zinc-100" : "hover:text-zinc-200"}`}
                  >
                    <span>{link.label}</span>
                    {link.isAdmin && (
                      <span className="rounded bg-zinc-800 px-1 py-0.5 text-[9px] font-mono text-zinc-300 uppercase">
                        Admin
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-xs text-zinc-300 font-medium">{user.name || user.email}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase border ${
                    user.role === "ADMIN"
                      ? "bg-zinc-800 text-zinc-200 border-zinc-700"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800"
                  }`}>
                    {user.role === "ADMIN" ? "Admin" : "Student"}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={() => { handleSelectRole("STUDENT"); setShowAuthModal(true); }}
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition"
                >
                  Student Login
                </button>
                <button
                  onClick={() => { handleSelectRole("ADMIN"); setShowAuthModal(true); }}
                  className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
                >
                  Admin Login
                </button>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </nav>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-zinc-800 bg-zinc-950 px-5 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.isAdmin)}
                className="block rounded-md px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 transition"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-zinc-800/60 flex flex-col gap-2">
              {user ? (
                <>
                  <p className="px-3 text-[11px] text-zinc-500 font-mono">{user.email} · {user.role}</p>
                  <button onClick={handleLogout} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition text-left">
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { handleSelectRole("STUDENT"); setShowAuthModal(true); setMobileMenuOpen(false); }}
                    className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition text-left"
                  >
                    Student Login
                  </button>
                  <button
                    onClick={() => { handleSelectRole("ADMIN"); setShowAuthModal(true); setMobileMenuOpen(false); }}
                    className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition text-left"
                  >
                    Admin Login
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Auth Modal */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAuthModal(false); }}
        >
          <div className="relative w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-200 text-xs"
              aria-label="Close"
            >
              ✕
            </button>

            {/* Role switcher */}
            <div className="flex rounded-lg bg-zinc-950 p-1 mb-5 border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => handleSelectRole("STUDENT")}
                className={`flex-1 py-1.5 font-medium rounded transition ${
                  loginRoleMode === "STUDENT" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => handleSelectRole("ADMIN")}
                className={`flex-1 py-1.5 font-medium rounded transition ${
                  loginRoleMode === "ADMIN" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Admin
              </button>
            </div>

            <h2 className="text-base font-semibold text-zinc-100">
              {loginRoleMode === "ADMIN" ? "Admin Sign In" : "Student Sign In"}
            </h2>
            <p className="text-xs text-zinc-400 mt-1 mb-4 leading-relaxed">
              {loginRoleMode === "ADMIN"
                ? "Access contest management, problem authoring, and grading tools."
                : "Compete in live rounds, solve problems, and track your rankings."}
            </p>

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
                  autoComplete="email"
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
                  autoComplete="current-password"
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-md bg-zinc-100 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {authLoading ? "Signing in…" : `Sign In as ${loginRoleMode === "ADMIN" ? "Admin" : "Student"}`}
              </button>

              <div className="rounded-md bg-zinc-950 border border-zinc-800/80 p-2.5 text-center text-[11px] text-zinc-500">
                Demo credentials:{" "}
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

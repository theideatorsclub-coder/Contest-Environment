"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "▦" },
  { label: "Contests", href: "/admin/contests", icon: "🏆" },
  { label: "Question Bank", href: "/admin/problems", icon: "📋" },
  { label: "Participants", href: "/admin/participants", icon: "👥" },
  { label: "Submissions", href: "/admin/submissions", icon: "📨" },
  { label: "Results & Leaderboard", href: "/admin/results", icon: "📊" },
  { label: "Analytics", href: "/admin/analytics", icon: "📈" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname?.startsWith(href) ?? false;
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed left-4 top-16 z-50 rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-300 lg:hidden"
      >
        {mobileOpen ? "✕" : "☰ Menu"}
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-64 border-r border-zinc-800 bg-zinc-950
          transition-transform duration-200
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <nav className="flex h-full flex-col gap-1 overflow-y-auto p-4">
          <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-zinc-600">
            Admin Console
          </div>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition ${
                  active
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}

          <div className="mt-auto border-t border-zinc-800 pt-3">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              <span className="text-sm">↩</span>
              Back to Site
            </Link>
          </div>
        </nav>
      </aside>
    </>
  );
}

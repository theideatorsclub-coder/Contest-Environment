"use client";

import { useEffect } from "react";

// ---- Stat Card ----
export function StatCard({
  label,
  value,
  icon,
  accent = "zinc",
}: {
  label: string;
  value: string | number;
  icon: string;
  accent?: "zinc" | "emerald" | "blue" | "amber" | "red";
}) {
  const accentMap: Record<string, string> = {
    zinc: "border-zinc-800 bg-zinc-900/40",
    emerald: "border-emerald-900/40 bg-emerald-950/20",
    blue: "border-blue-900/40 bg-blue-950/20",
    amber: "border-amber-900/40 bg-amber-950/20",
    red: "border-red-900/40 bg-red-950/20",
  };
  return (
    <div className={`rounded-xl border p-5 ${accentMap[accent]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <span className="text-base">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-bold font-mono text-zinc-100">{value}</p>
    </div>
  );
}

// ---- Loading Spinner ----
export function LoadingSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-zinc-400" />
      <p className="mt-3 text-xs text-zinc-500 font-mono">{label}</p>
    </div>
  );
}

// ---- Empty State ----
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-sm text-zinc-500">
        ∅
      </div>
      <h3 className="mt-4 text-sm font-medium text-zinc-300">{title}</h3>
      {description && (
        <p className="mt-1.5 text-xs text-zinc-500 max-w-sm">{description}</p>
      )}
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="mt-4 rounded-md bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}

// ---- Error Banner ----
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-900/40 bg-red-950/20 px-4 py-2.5 text-xs text-red-400">
      {message}
    </div>
  );
}

// ---- Success Banner ----
export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-4 py-2.5 text-xs text-emerald-400">
      {message}
    </div>
  );
}

// ---- Confirm Dialog ----
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition ${
              danger
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Toast ----
export function Toast({
  message,
  type = "success",
  onClose,
}: {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colorMap: Record<string, string> = {
    success: "border-emerald-900/40 bg-emerald-950/20 text-emerald-400",
    error: "border-red-900/40 bg-red-950/20 text-red-400",
    info: "border-zinc-800 bg-zinc-900 text-zinc-300",
  };
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
      <div
        className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-xs font-medium shadow-xl ${colorMap[type]}`}
      >
        <span>{message}</span>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
          ✕
        </button>
      </div>
    </div>
  );
}

// ---- Pagination ----
export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-40 disabled:hover:bg-zinc-900"
      >
        ← Prev
      </button>
      <span className="px-3 py-1.5 text-xs font-mono text-zinc-400">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-40 disabled:hover:bg-zinc-900"
      >
        Next →
      </button>
    </div>
  );
}

// ---- Difficulty Badge ----
export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const diff = (difficulty || "").toLowerCase();
  const colorMap: Record<string, string> = {
    easy: "bg-emerald-950/30 text-emerald-400 border-emerald-900/40",
    medium: "bg-amber-950/30 text-amber-400 border-amber-900/40",
    hard: "bg-red-950/30 text-red-400 border-red-900/40",
  };
  return (
    <span
      className={`rounded border px-2 py-0.5 text-[10px] font-mono ${colorMap[diff] || "bg-zinc-900 text-zinc-400 border-zinc-800"}`}
    >
      {difficulty}
    </span>
  );
}

// ---- Status Badge ----
export function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  const colorMap: Record<string, string> = {
    LIVE: "border-emerald-900/40 bg-emerald-950/20 text-emerald-400",
    UPCOMING: "border-zinc-800 bg-zinc-900 text-zinc-400",
    ENDED: "border-zinc-800 bg-zinc-950 text-zinc-600",
    ACCEPTED: "border-emerald-900/40 bg-emerald-950/30 text-emerald-400",
    WRONG_ANSWER: "border-red-900/40 bg-red-950/30 text-red-400",
    COMPILATION_ERROR: "border-orange-900/40 bg-orange-950/30 text-orange-400",
    TIME_LIMIT_EXCEEDED: "border-amber-900/40 bg-amber-950/30 text-amber-400",
    RUNTIME_ERROR: "border-red-900/40 bg-red-950/30 text-red-400",
    PENDING: "border-zinc-800 bg-zinc-900 text-zinc-400",
    IN_QUEUE: "border-zinc-800 bg-zinc-900 text-zinc-400",
    PROCESSING: "border-blue-900/40 bg-blue-950/30 text-blue-400",
  };
  return (
    <span
      className={`rounded border px-2 py-0.5 text-[10px] font-mono ${colorMap[s] || "border-zinc-800 bg-zinc-900 text-zinc-300"}`}
    >
      {s === "LIVE" ? (
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      ) : (
        s.replace(/_/g, " ")
      )}
    </span>
  );
}

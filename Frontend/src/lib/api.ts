// Centralized API configuration for TIC Contest.
// Uses NEXT_PUBLIC_API_URL env var with fallback to localhost:8000.
// Replace hardcoded "http://localhost:8000" calls across the app.

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Get the JWT token from localStorage. */
export function getAuthToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("tic_token") || "";
}

/** Get the current user object from localStorage. */
export function getCurrentUser(): UserPayload | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("tic_user");
  if (!stored) return null;
  try {
    return JSON.parse(stored) as UserPayload;
  } catch {
    return null;
  }
}

export interface UserPayload {
  email: string;
  userId: string;
  name: string;
  role: "ADMIN" | "STUDENT" | string;
}

/** Build headers with optional auth bearer token. */
export function authHeaders(token?: string): Record<string, string> {
  const t = token ?? getAuthToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

/** Fetch wrapper that prepends API_BASE_URL and includes JSON headers. */
export async function apiFetch<T = any>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, headers, ...rest } = options || {};
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: { ...authHeaders(token), ...(headers as Record<string, string>) },
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

/** Fetch with auth, returns null on failure (non-throwing). */
export async function apiFetchSafe<T = any>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T | null> {
  try {
    return await apiFetch<T>(path, options);
  } catch {
    return null;
  }
}

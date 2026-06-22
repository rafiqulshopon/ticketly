import type { UserListResponse } from "@ticketly/shared";

/**
 * Backend origin (no /api suffix). Empty in dev → requests are same-origin and
 * Vite proxies /api and /health to the NestJS server (vite.config.ts). In
 * production set VITE_API_URL to the backend origin (e.g. https://ticketly.up.railway.app).
 * This matches the Better Auth client's baseURL convention in lib/auth.ts.
 */
const API_ORIGIN = import.meta.env.VITE_API_URL || "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thin fetch wrapper. credentials: include carries the Better Auth session cookie.
 *  `path` is the route AFTER the global /api prefix (e.g. "/auth/sign-in"). */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_ORIGIN}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export interface HealthResponse {
  status: string;
  service: string;
  time: string;
}

/** Health is served at the API root (excluded from the global /api prefix), not /api/health.
 *  Public endpoint — no credentials needed (don't send the session cookie to it). */
export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_ORIGIN}/health`);
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as HealthResponse;
}

export interface GetUsersParams {
  /** Case-insensitive substring match on email or name. */
  q?: string;
  /** 1-based page number. */
  page?: number;
  /** Page size (server clamps to 1–100). */
  pageSize?: number;
}

/** Admin-only user directory. Pass an AbortSignal so the caller can cancel
 *  in-flight requests when the search query / page changes. */
export async function getUsers(
  params: GetUsersParams = {},
  init?: RequestInit,
): Promise<UserListResponse> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.pageSize != null) qs.set("pageSize", String(params.pageSize));
  const query = qs.toString();
  return api<UserListResponse>(`/users${query ? `?${query}` : ""}`, init);
}

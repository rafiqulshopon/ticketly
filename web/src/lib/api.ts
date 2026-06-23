import axios, { type AxiosRequestConfig } from "axios";
import type { UserListResponse } from "@ticketly/shared";

/**
 * Backend origin (no /api suffix). Empty in dev → requests are same-origin and
 * Vite proxies /api and /health to the NestJS server (vite.config.ts). In
 * production set VITE_API_URL to the backend origin (e.g. https://ticketly.up.railway.app).
 * This matches the Better Auth client's baseURL convention in lib/auth.ts.
 */
const API_ORIGIN = import.meta.env.VITE_API_URL || "";

/** Shared axios instance. `withCredentials` carries the Better Auth session cookie
 *  on every request; callers can opt out per-call (see getHealth). */
const http = axios.create({
  baseURL: API_ORIGIN,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Convert an axios rejection into our ApiError when there's an HTTP response,
 *  preserving the status code. Network/abort errors have no response and are
 *  returned as-is so callers can read the underlying message. */
function toApiError(err: unknown): Error {
  if (axios.isAxiosError(err) && err.response) {
    return new ApiError(err.response.status, `${err.response.status} ${err.response.statusText}`);
  }
  return err instanceof Error ? err : new Error(String(err));
}

/** Thin axios wrapper. `path` is the route AFTER the global /api prefix
 *  (e.g. "/users"). Defaults to GET; pass an AxiosRequestConfig to override
 *  (method/headers/signal/…). Pass `{ signal }` to cancel an in-flight request. */
export async function api<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await http.request<T>({ url: `/api${path}`, method: "GET", ...config });
    return res.status === 204 ? (undefined as T) : res.data;
  } catch (err) {
    throw toApiError(err);
  }
}

export interface HealthResponse {
  status: string;
  service: string;
  time: string;
}

/** Health is served at the API root (excluded from the global /api prefix), not
 *  /api/health. Public endpoint — credentials are explicitly disabled here so
 *  the session cookie isn't sent to it. */
export async function getHealth(): Promise<HealthResponse> {
  try {
    const res = await http.get<HealthResponse>("/health", { withCredentials: false });
    return res.data;
  } catch (err) {
    throw toApiError(err);
  }
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
  config?: AxiosRequestConfig,
): Promise<UserListResponse> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.pageSize != null) qs.set("pageSize", String(params.pageSize));
  const query = qs.toString();
  return api<UserListResponse>(`/users${query ? `?${query}` : ""}`, config);
}

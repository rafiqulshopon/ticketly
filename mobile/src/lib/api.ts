import axios, { type AxiosRequestConfig } from "axios";
import type {
  AssigneeOption,
  CreateReplyInput,
  CreateUserInput,
  DashboardStats,
  EditUserInput,
  Notification,
  PolishReplyInput,
  PolishReplyResult,
  SummarizeTicketResult,
  TicketActivityItem,
  TicketDetail,
  TicketListResponse,
  UnreadCount,
  UpdateTicketInput,
  UserListItem,
  UserListResponse,
} from "@ticketly/shared";
import { authClient, API_ORIGIN } from "@/lib/auth";

/**
 * Shared axios instance. RN has no cookie jar, so a request interceptor attaches
 * the Better Auth session cookie (from SecureStore via authClient.getCookie) as a
 * `Cookie` header on every request — the same cookie the web sends via
 * withCredentials. Callers can opt out per-call (see getHealth).
 */
const http = axios.create({
  baseURL: API_ORIGIN,
  headers: { "Content-Type": "application/json" },
});

// Attach the session cookie to every outgoing request. `getCookie` is cached
// in memory by the expoClient plugin after the initial SecureStore load, so this
// is cheap. Awaited defensively so it works whether the plugin returns a string
// or a Promise<string>.
http.interceptors.request.use(async (config) => {
  const cookie = await authClient.getCookie();
  if (cookie) {
    config.headers.set("Cookie", cookie);
  }
  return config;
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
 *  /api/health. Public endpoint — we skip the cookie so it isn't sent there. */
export async function getHealth(): Promise<HealthResponse> {
  try {
    const res = await http.get<HealthResponse>("/health");
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

export interface GetTicketsParams {
  /** Case-insensitive substring match on subject or requester email. */
  q?: string;
  /** Optional equality filters (wired into the UI later). */
  status?: string;
  category?: string;
  priority?: string;
  assigneeId?: string;
  /** Dashboard bucket deep-link: "all" | "open" | "resolvedByAi". Ignored by the server when status is also set. */
  view?: string;
  /** Sort column — createdAt | subject | requesterName | status (server default: createdAt; server 400s on others). */
  sortBy?: string;
  /** Sort direction — "asc" | "desc" (server default: desc). */
  sortDir?: string;
  /** 1-based page number. */
  page?: number;
  /** Page size (server clamps to 1–100). */
  pageSize?: number;
}

/** Ticket list (server returns newest first). Pass an AbortSignal so the caller
 *  can cancel in-flight requests when the search query / page changes. */
export async function getTickets(
  params: GetTicketsParams = {},
  config?: AxiosRequestConfig,
): Promise<TicketListResponse> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.status) qs.set("status", params.status);
  if (params.category) qs.set("category", params.category);
  if (params.priority) qs.set("priority", params.priority);
  if (params.assigneeId) qs.set("assigneeId", params.assigneeId);
  if (params.view) qs.set("view", params.view);
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortDir) qs.set("sortDir", params.sortDir);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.pageSize != null) qs.set("pageSize", String(params.pageSize));
  const query = qs.toString();
  return api<TicketListResponse>(`/tickets${query ? `?${query}` : ""}`, config);
}

/** Single ticket (metadata only). Throws `ApiError(status)` (e.g. 404 when the id
 *  doesn't exist) on failure. Pass an AbortSignal so the caller can cancel when
 *  navigating away. */
export async function getTicket(id: number, config?: AxiosRequestConfig): Promise<TicketDetail> {
  return api<TicketDetail>(`/tickets/${encodeURIComponent(id)}`, config);
}

/** A ticket's activity timeline, newest first (server-capped). Throws
 *  `ApiError(status)` (404 when the id is unknown or out of scope for the caller)
 *  on failure. Pass an AbortSignal so the caller can cancel when navigating away
 *  or switching tabs. */
export async function getTicketActivity(
  id: number,
  config?: AxiosRequestConfig,
): Promise<TicketActivityItem[]> {
  return api<TicketActivityItem[]>(`/tickets/${encodeURIComponent(id)}/activity`, config);
}

/** Dashboard metrics (admin only). Throws `ApiError(status)` (403 for non-admins)
 *  on failure. Pass an AbortSignal so the caller can cancel when navigating away. */
export async function getDashboardStats(config?: AxiosRequestConfig): Promise<DashboardStats> {
  return api<DashboardStats>("/dashboard/stats", config);
}

/** Staff available for assignment (admins + agents). Lightweight — id/name/role
 *  only. Throws `ApiError(status)` on failure. */
export async function getAssignees(config?: AxiosRequestConfig): Promise<AssigneeOption[]> {
  return api<AssigneeOption[]>("/tickets/assignees", config);
}

/** Update a ticket. Today only `assigneeId` is supported (a staff id, or null to
 *  unassign). Returns the updated ticket. Throws `ApiError(status)` (e.g. 400 for
 *  an invalid assignee) on failure. */
export async function updateTicket(
  id: number,
  input: UpdateTicketInput,
  config?: AxiosRequestConfig,
): Promise<TicketDetail> {
  return api<TicketDetail>(`/tickets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    data: input,
    ...config,
  });
}

/** Reply to a ticket — appends an outbound agent message to the thread. Returns
 *  the refreshed ticket (same shape as updateTicket) so the caller can
 *  setQueryData directly. Throws `ApiError(status)` (400 empty body, 404 unknown
 *  ticket, 403 wrong role) on failure. */
export async function replyToTicket(
  id: number,
  input: CreateReplyInput,
  config?: AxiosRequestConfig,
): Promise<TicketDetail> {
  return api<TicketDetail>(`/tickets/${encodeURIComponent(id)}/replies`, {
    method: "POST",
    data: input,
    ...config,
  });
}

/** AI-polish a drafted reply against the ticket's conversation context. The
 *  backend reads the thread server-side, so only the draft body is sent. Returns
 *  the improved body (plain text) for the agent to review before sending — it
 *  does not post the reply. Throws `ApiError(status)` (400 empty/too-long draft,
 *  404 unknown ticket, 502 on an AI/provider outage) on failure. */
export async function polishReply(
  id: number,
  input: PolishReplyInput,
  config?: AxiosRequestConfig,
): Promise<PolishReplyResult> {
  return api<PolishReplyResult>(`/tickets/${encodeURIComponent(id)}/polish`, {
    method: "POST",
    data: input,
    ...config,
  });
}

/** AI-summarize a ticket and its conversation. No request body — the backend
 *  reads the thread server-side, keyed by the ticket id. Returns a plain-text
 *  digest generated fresh on every call (never persisted). Throws
 *  `ApiError(status)` (404 unknown ticket, 502 on an AI/provider outage) on
 *  failure. */
export async function summarizeTicket(
  id: number,
  config?: AxiosRequestConfig,
): Promise<SummarizeTicketResult> {
  return api<SummarizeTicketResult>(`/tickets/${encodeURIComponent(id)}/summarize`, {
    method: "POST",
    ...config,
  });
}

/** Admin-only user provisioning. Throws `ApiError(status)` (e.g. 409 for a
 *  duplicate email) on failure; the shared schema validates the payload. */
export async function createUser(input: CreateUserInput): Promise<UserListItem> {
  return api<UserListItem>("/users", { method: "POST", data: input });
}

/** Admin-only user update. `password` is optional — leave empty to keep it
 *  unchanged. Throws `ApiError(status)` (e.g. 409 duplicate email, 404 not
 *  found) on failure. */
export async function updateUser(id: string, input: EditUserInput): Promise<UserListItem> {
  return api<UserListItem>(`/users/${encodeURIComponent(id)}`, { method: "PATCH", data: input });
}

/** Admin-only soft delete. Revokes the user's sessions, drops their credentials,
 *  and hides them from the directory (the row is retained). Throws
 *  `ApiError(status)` (e.g. 400 admin can't be deleted, 404 not found). */
export async function deleteUser(id: string): Promise<void> {
  return api<void>(`/users/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** The current user's notifications, newest first (server-capped). Pass an
 *  AbortSignal so the caller can cancel when the feed closes. Throws
 *  `ApiError(status)` (403 wrong role) on failure. */
export async function getNotifications(config?: AxiosRequestConfig): Promise<Notification[]> {
  return api<Notification[]>("/notifications", config);
}

/** Unread notification count for the bell badge. Lightweight endpoint meant to be
 *  polled on an interval. Throws `ApiError(status)` on failure. */
export async function getUnreadNotificationCount(config?: AxiosRequestConfig): Promise<UnreadCount> {
  return api<UnreadCount>("/notifications/unread-count", config);
}

/** Mark a single notification as read. No response body (204). Throws
 *  `ApiError(status)` (404 when the id isn't the caller's) on failure. */
export async function markNotificationRead(id: string, config?: AxiosRequestConfig): Promise<void> {
  return api<void>(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", ...config });
}

/** Mark every unread notification for the caller as read. No response body (204).
 *  Throws `ApiError(status)` on failure. */
export async function markAllNotificationsRead(config?: AxiosRequestConfig): Promise<void> {
  return api<void>("/notifications/read-all", { method: "POST", ...config });
}

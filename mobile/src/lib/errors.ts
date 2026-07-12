import { ApiError } from "@/lib/api";

/**
 * Map a thrown error to a user-facing message. Consolidates the three strategies
 * that used to live inline per-screen: raw `(error as Error).message` (tickets
 * list / notifications), a local 401/403 `toErrorMessage` (dashboard / users),
 * and a 401/403/404 `toDetailErrorMessage` (ticket detail). `ApiError` carries
 * the HTTP status; pass a `fallback` for screen-specific copy when the default
 * ("Something went wrong.") is too generic.
 */
export function toErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session may have expired — please sign in again.";
    if (err.status === 403) return "You don't have permission to view this.";
    if (err.status === 404) return "We couldn't find what you were looking for.";
    return err.message || fallback;
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

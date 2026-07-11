// Verbatim port of web/src/lib/format.ts — pure, framework-agnostic helpers
// shared by the notification feed, activity timeline, and message thread.

/** Format a duration in milliseconds as a compact human string, e.g.
 *  "2d 4h", "3h 15m", "45m 10s", "12s". Returns "—" for null/undefined/NaN
 *  (e.g. when there's no resolution-time data yet). */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Compact "x ago" for timestamps — fine-grained for recent, absolute date for
 *  old. Returns "" for an unparseable input. Shared by the notification bell and
 *  the activity timeline. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  const min = Math.round(diff / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Up-to-two-letter initials from a display name or email handle, e.g.
 *  "Jane Doe" → "JD", "admin@x.com" → "AD". Returns "?" for empty input. */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/[\s@._]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

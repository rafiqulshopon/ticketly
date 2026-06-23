import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { UserListItem, UserListResponse } from "@ticketly/shared";
import { ApiError, getUsers } from "@/lib/api";
import { UsersPage } from "./users";

// The api client is mocked so tests never hit the network. `ApiError` stays the
// real class (via importOriginal) so the page's `instanceof` checks still work.
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, getUsers: vi.fn() };
});

const USERS: UserListItem[] = [
  {
    id: "u1",
    name: "Alice",
    email: "alice@example.com",
    role: "admin",
    emailVerified: true,
    banned: false,
    banReason: null,
    banExpires: null,
    createdAt: "2024-01-15T10:00:00.000Z",
  },
  {
    id: "u2",
    name: "Bob",
    email: "bob@example.com",
    role: "agent",
    emailVerified: true,
    banned: true,
    banReason: "spam",
    banExpires: null,
    createdAt: "2024-02-20T10:00:00.000Z",
  },
];

function pageOf(
  items: UserListItem[],
  total = items.length,
  pageNo = 1,
): UserListResponse {
  return { items, total, page: pageNo, pageSize: 20 };
}

function renderWithClient(ui: ReactElement) {
  // retry:false so error tests surface immediately; fresh client per test.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("UsersPage", () => {
  beforeEach(() => {
    vi.mocked(getUsers).mockReset();
    vi.mocked(getUsers).mockResolvedValue(pageOf([]));
  });

  it("renders a loading state, then rows with role/status badges and the summary", async () => {
    vi.mocked(getUsers).mockResolvedValue(pageOf(USERS));

    renderWithClient(<UsersPage />);

    // Footer shows "Loading…" while the first query is pending.
    expect(screen.getByText(/Loading/)).toBeInTheDocument();

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("Banned")).toBeInTheDocument();

    // `.` matches the en dash so the assertion is dash-agnostic.
    expect(screen.getByText(/Showing 1.2 of 2/)).toBeInTheDocument();
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();

    // Initial fetch is page 1 with an AbortSignal wired through for cancellation.
    expect(getUsers).toHaveBeenCalledWith(
      { q: undefined, page: 1, pageSize: 20 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("shows the empty state when there are no users", async () => {
    renderWithClient(<UsersPage />);
    expect(await screen.findByText("No users yet.")).toBeInTheDocument();
  });

  it("debounces the search box and filters results", async () => {
    const user = userEvent.setup();
    vi.mocked(getUsers).mockImplementation(async (params = {}) => {
      const q = (params.q ?? "").toLowerCase();
      const items = USERS.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
      return { items, total: items.length, page: params.page ?? 1, pageSize: 20 };
    });

    renderWithClient(<UsersPage />);
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search users"), "alice");

    // Debounce is 300ms; waitFor crosses it.
    await waitFor(() =>
      expect(getUsers).toHaveBeenCalledWith(
        expect.objectContaining({ q: "alice" }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("bob@example.com")).not.toBeInTheDocument());
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows an empty-search message when nothing matches", async () => {
    const user = userEvent.setup();
    vi.mocked(getUsers).mockImplementation(async (params = {}) => {
      const q = (params.q ?? "").toLowerCase();
      const items = USERS.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
      return { items, total: items.length, page: params.page ?? 1, pageSize: 20 };
    });

    renderWithClient(<UsersPage />);
    await screen.findByText("Alice");

    await user.type(screen.getByLabelText("Search users"), "zzz");

    expect(await screen.findByText(/No users match/)).toBeInTheDocument();
  });

  it("paginates between pages", async () => {
    const user = userEvent.setup();
    const all: UserListItem[] = Array.from({ length: 25 }, (_, i) => ({
      id: `u${i}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      role: (i === 0 ? "admin" : "agent") as UserListItem["role"],
      emailVerified: true,
      banned: false,
      banReason: null,
      banExpires: null,
      createdAt: "2024-01-01T00:00:00.000Z",
    }));
    vi.mocked(getUsers).mockImplementation(async (params = {}) => {
      const p = params.page ?? 1;
      return { items: all.slice((p - 1) * 20, p * 20), total: 25, page: p, pageSize: 20 };
    });

    renderWithClient(<UsersPage />);

    expect(await screen.findByText("User 1")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1.20 of 25/)).toBeInTheDocument();
    const prev = screen.getByRole("button", { name: "Previous" });
    const next = screen.getByRole("button", { name: "Next" });
    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();

    await user.click(next);

    expect(await screen.findByText("User 21")).toBeInTheDocument();
    expect(screen.queryByText("User 1")).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 21.25 of 25/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("surfaces an error and recovers on retry", async () => {
    const user = userEvent.setup();
    vi.mocked(getUsers)
      .mockRejectedValueOnce(new ApiError(500, "500 Internal Server Error"))
      .mockResolvedValue(pageOf(USERS));

    renderWithClient(<UsersPage />);

    expect(await screen.findByText("500 Internal Server Error")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Try again" });
    expect(retry).toBeInTheDocument();

    await user.click(retry);

    expect(await screen.findByText("Alice")).toBeInTheDocument();
  });

  it("maps a 403 to a permission message", async () => {
    vi.mocked(getUsers).mockRejectedValue(new ApiError(403, "403 Forbidden"));
    renderWithClient(<UsersPage />);
    expect(await screen.findByText("You don't have permission to view users.")).toBeInTheDocument();
  });
});

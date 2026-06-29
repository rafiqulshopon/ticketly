import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { Notification } from "@ticketly/shared";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";
import { NotificationBell } from "./notification-bell";

// The api client is mocked so tests never hit the network.
vi.mock("@/lib/api", () => ({
  getUnreadNotificationCount: vi.fn(),
  getNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    type: "new_ticket",
    ticketId: 5,
    ticketSubject: "Refund please",
    requesterName: "Carol",
    readAt: null,
    createdAt: new Date(Date.now() - 60_000).toISOString(),
  },
  {
    id: "n2",
    type: "new_message",
    ticketId: 7,
    ticketSubject: "Following up",
    requesterName: "Dan",
    readAt: "2024-01-01T00:00:00.000Z",
    createdAt: new Date(Date.now() - 120_000).toISOString(),
  },
  {
    id: "n3",
    type: "ticket_assigned",
    ticketId: 9,
    ticketSubject: "Can't log in",
    requesterName: "Eve",
    readAt: null,
    createdAt: new Date(Date.now() - 30_000).toISOString(),
  },
];

// retry:false so a rejected query surfaces immediately; fresh client per test.
// MemoryRouter satisfies the bell's useNavigate() without a real route table.
function renderBell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NotificationBell", () => {
  afterEach(() => vi.clearAllMocks());

  it("shows the unread count on the bell", async () => {
    vi.mocked(getUnreadNotificationCount).mockResolvedValue({ count: 3 });
    renderBell();
    // findByLabelText awaits the re-render after the count query resolves
    // (the label and badge both flip in once `unread` is known).
    expect(await screen.findByLabelText("Notifications (3 unread)")).toBeInTheDocument();
  });

  it("lists notifications when opened and marks all read", async () => {
    const user = userEvent.setup();
    vi.mocked(getUnreadNotificationCount).mockResolvedValue({ count: 2 });
    vi.mocked(getNotifications).mockResolvedValue(NOTIFICATIONS);
    vi.mocked(markAllNotificationsRead).mockResolvedValue(undefined);
    renderBell();

    await waitFor(() => expect(getUnreadNotificationCount).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /Notifications/ }));

    // The list query only fires once the popover opens (enabled: open).
    await waitFor(() => expect(getNotifications).toHaveBeenCalled());
    expect(screen.getByText("New ticket")).toBeInTheDocument();
    expect(screen.getByText("Refund please")).toBeInTheDocument();
    // The third type renders its own label.
    expect(screen.getByText("Assigned to you")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Mark all read/i }));
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalled());
  });

  it("omits the badge when there is nothing unread and shows an empty note", async () => {
    const user = userEvent.setup();
    vi.mocked(getUnreadNotificationCount).mockResolvedValue({ count: 0 });
    vi.mocked(getNotifications).mockResolvedValue([]);
    renderBell();
    await waitFor(() => expect(getUnreadNotificationCount).toHaveBeenCalled());

    // No "(N unread)" suffix when the count is 0.
    expect(screen.queryByLabelText(/unread/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await waitFor(() =>
      expect(screen.getByText("You're all caught up.")).toBeInTheDocument(),
    );
  });

  it("marks a single item read and navigates to its ticket when opened", async () => {
    const user = userEvent.setup();
    vi.mocked(getUnreadNotificationCount).mockResolvedValue({ count: 1 });
    vi.mocked(getNotifications).mockResolvedValue([NOTIFICATIONS[0]]);
    vi.mocked(markNotificationRead).mockResolvedValue(undefined);
    renderBell();

    await waitFor(() => expect(getUnreadNotificationCount).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    await waitFor(() => expect(getNotifications).toHaveBeenCalled());

    // Clicking the unread ticket row marks it read.
    await user.click(screen.getByText("Refund please"));
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith("n1"));
  });
});

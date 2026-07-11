/// <reference types="jest" />
import { render } from "@testing-library/react-native";
import { notificationTypeSchema, type Notification } from "@ticketly/shared";
import { NOTIFICATION_META, NotificationItem } from "./notification-item";

// lucide-react-native ships ESM that jest-expo doesn't transform, and its icons
// are decorative in this test — stub them with a null component so the row
// renders without pulling in the real SVGs.
jest.mock("lucide-react-native", () => {
  const Stub = () => null;
  return { __esModule: true, Inbox: Stub, MessageSquare: Stub, UserPlus: Stub };
});

const baseNotification: Notification = {
  id: "notif-1",
  type: "new_message",
  ticketId: 42,
  ticketSubject: "Can't reset my password",
  requesterName: "Jane Doe",
  readAt: null,
  createdAt: new Date().toISOString(),
};

describe("NOTIFICATION_META", () => {
  // A Record over the type union forces an entry per type — assert the map stays
  // complete as the enum evolves (same shape as ticket-badges' status test).
  it("maps every notification type to a label + icon", () => {
    for (const type of notificationTypeSchema.options) {
      const meta = NOTIFICATION_META[type];
      expect(meta).toBeDefined();
      expect(typeof meta.label).toBe("string");
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.Icon).toBeDefined();
    }
  });

  it("labels the three notification types", () => {
    expect(NOTIFICATION_META.new_ticket.label).toBe("New ticket");
    expect(NOTIFICATION_META.new_message.label).toBe("New message");
    expect(NOTIFICATION_META.ticket_assigned.label).toBe("Assigned to you");
  });
});

describe("NotificationItem", () => {
  it("renders the label, subject, and requester", async () => {
    const { getByText } = await render(<NotificationItem n={baseNotification} onPress={jest.fn()} />);
    expect(getByText("New message")).toBeTruthy();
    expect(getByText("Can't reset my password")).toBeTruthy();
    // requesterName appears in the "name · time" line.
    expect(getByText(/Jane Doe/)).toBeTruthy();
  });

  it("shows the unread dot only when the notification is unread", async () => {
    const unread = await render(<NotificationItem n={baseNotification} onPress={jest.fn()} />);
    expect(unread.queryByTestId("unread-dot")).not.toBeNull();

    const read = await render(
      <NotificationItem
        n={{ ...baseNotification, readAt: "2026-07-11T00:00:00.000Z" }}
        onPress={jest.fn()}
      />,
    );
    expect(read.queryByTestId("unread-dot")).toBeNull();
  });
});

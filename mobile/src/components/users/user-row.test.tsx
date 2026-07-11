/// <reference types="jest" />
import { render } from "@testing-library/react-native";
import type { UserListItem } from "@ticketly/shared";
import { UserRow } from "./user-row";

// lucide-react-native ships ESM that jest-expo doesn't transform, and the icons
// are decorative here — stub them with a null component so the row renders.
jest.mock("lucide-react-native", () => {
  const Stub = () => null;
  return { __esModule: true, Pencil: Stub, Trash2: Stub };
});

const baseUser: UserListItem = {
  id: "user-1",
  email: "jane@example.com",
  name: "Jane Doe",
  role: "agent",
  emailVerified: true,
  banned: false,
  banReason: null,
  banExpires: null,
  createdAt: "2026-01-15T00:00:00.000Z",
};

describe("UserRow", () => {
  it("renders the name, email, role, and status", async () => {
    const { getByText } = await render(
      <UserRow user={baseUser} onEditUser={jest.fn()} onDeleteUser={jest.fn()} />,
    );
    expect(getByText("Jane Doe")).toBeTruthy();
    expect(getByText("jane@example.com")).toBeTruthy();
    expect(getByText("Agent")).toBeTruthy();
    expect(getByText("Active")).toBeTruthy();
  });

  it("disables delete for admins but enables it for agents", async () => {
    const admin: UserListItem = { ...baseUser, id: "user-2", role: "admin", name: "Admin User" };

    const adminTree = await render(
      <UserRow user={admin} onEditUser={jest.fn()} onDeleteUser={jest.fn()} />,
    );
    // Pressable consumes `disabled` and isn't exposed on the host view; the
    // accessibilityState we set explicitly is forwarded and reflects the state.
    expect(adminTree.getByTestId("delete-user").props.accessibilityState.disabled).toBe(true);
    expect(adminTree.getByText("Admin")).toBeTruthy();

    const agentTree = await render(
      <UserRow user={baseUser} onEditUser={jest.fn()} onDeleteUser={jest.fn()} />,
    );
    expect(agentTree.getByTestId("delete-user").props.accessibilityState.disabled).toBe(false);
  });

  it("shows the Banned status when the user is banned", async () => {
    const banned: UserListItem = { ...baseUser, banned: true, banReason: "spam", banExpires: null };
    const { getByText } = await render(
      <UserRow user={banned} onEditUser={jest.fn()} onDeleteUser={jest.fn()} />,
    );
    expect(getByText("Banned")).toBeTruthy();
  });
});

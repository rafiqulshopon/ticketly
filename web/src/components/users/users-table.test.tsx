import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserListItem, UserListResponse } from "@ticketly/shared";
import { UsersTable } from "./users-table";

const admin: UserListItem = {
  id: "a1",
  name: "Alice Admin",
  email: "alice@example.com",
  role: "admin",
  emailVerified: true,
  banned: false,
  banReason: null,
  banExpires: null,
  createdAt: "2024-01-01T00:00:00.000Z",
};

const agent: UserListItem = {
  id: "g1",
  name: "Gary Agent",
  email: "gary@example.com",
  role: "agent",
  emailVerified: true,
  banned: false,
  banReason: null,
  banExpires: null,
  createdAt: "2024-02-01T00:00:00.000Z",
};

const data: UserListResponse = { items: [admin, agent], total: 2, page: 1, pageSize: 20 };
const noop = () => {};

describe("UsersTable delete action", () => {
  it("disables the delete button for admin rows and enables it for agents", () => {
    render(
      <UsersTable
        data={data}
        isPending={false}
        isFetching={false}
        isError={false}
        error={null}
        search=""
        page={1}
        pageSize={20}
        onRefetch={noop}
        onPageChange={noop}
        onEditUser={noop}
        onDeleteUser={noop}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete Alice Admin" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Gary Agent" })).toBeEnabled();
  });

  it("calls onDeleteUser with the row's user when an agent's delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDeleteUser = vi.fn();
    render(
      <UsersTable
        data={data}
        isPending={false}
        isFetching={false}
        isError={false}
        error={null}
        search=""
        page={1}
        pageSize={20}
        onRefetch={noop}
        onPageChange={noop}
        onEditUser={noop}
        onDeleteUser={onDeleteUser}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete Gary Agent" }));

    expect(onDeleteUser).toHaveBeenCalledTimes(1);
    expect(onDeleteUser).toHaveBeenCalledWith(agent);
  });
});

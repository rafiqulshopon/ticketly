import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { UserListItem } from "@ticketly/shared";
import { ApiError, deleteUser } from "@/lib/api";
import { DeleteUserDialog } from "./delete-user-dialog";

// The api client is mocked so tests never hit the network. `ApiError` stays the
// real class (via importOriginal) so the dialog's `instanceof` checks still work.
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, deleteUser: vi.fn() };
});

const USER: UserListItem = {
  id: "u1",
  name: "Carol",
  email: "carol@example.com",
  role: "agent",
  emailVerified: true,
  banned: false,
  banReason: null,
  banExpires: null,
  createdAt: "2024-01-15T10:00:00.000Z",
};

// retry:false so a rejected mutation surfaces immediately; fresh client per test.
// The client is returned so a test can spy on `invalidateQueries`.
function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  const utils = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { ...utils, queryClient };
}

describe("DeleteUserDialog", () => {
  beforeEach(() => {
    vi.mocked(deleteUser).mockReset();
  });

  it("shows the selected user's name when open", async () => {
    renderWithClient(<DeleteUserDialog user={USER} open onOpenChange={() => {}} />);
    expect(await screen.findByText("Carol")).toBeInTheDocument();
  });

  it("deletes the user, invalidates the list, and closes on success", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteUser).mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const { queryClient } = renderWithClient(
      <DeleteUserDialog user={USER} open onOpenChange={onOpenChange} />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(screen.getByRole("button", { name: "Delete user" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(vi.mocked(deleteUser)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deleteUser).mock.calls[0][0]).toBe("u1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users"] });
  });

  it("shows an admin message and stays open on 400", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteUser).mockRejectedValue(new ApiError(400, "400 Bad Request"));
    const onOpenChange = vi.fn();
    renderWithClient(<DeleteUserDialog user={USER} open onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Delete user" }));

    expect(await screen.findByText("Admins cannot be deleted.")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("shows a not-found message and stays open on 404", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteUser).mockRejectedValue(new ApiError(404, "404 Not Found"));
    const onOpenChange = vi.fn();
    renderWithClient(<DeleteUserDialog user={USER} open onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Delete user" }));

    expect(await screen.findByText("User not found.")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

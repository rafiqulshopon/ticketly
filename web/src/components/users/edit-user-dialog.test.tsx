import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { UserListItem } from "@ticketly/shared";
import { ApiError, updateUser } from "@/lib/api";
import { EditUserDialog } from "./edit-user-dialog";

// The api client is mocked so tests never hit the network. `ApiError` stays the
// real class (via importOriginal) so the dialog's `instanceof` checks still work.
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, updateUser: vi.fn() };
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

describe("EditUserDialog", () => {
  beforeEach(() => {
    vi.mocked(updateUser).mockReset();
  });

  it("pre-fills name and email (password blank) when opened", async () => {
    renderWithClient(<EditUserDialog user={USER} open onOpenChange={() => {}} />);
    expect(await screen.findByDisplayValue("Carol")).toBeInTheDocument();
    expect(screen.getByDisplayValue("carol@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("saves name/email and leaves the password unchanged when blank", async () => {
    const user = userEvent.setup();
    vi.mocked(updateUser).mockResolvedValue(USER);
    const onOpenChange = vi.fn();
    const { queryClient } = renderWithClient(
      <EditUserDialog user={USER} open onOpenChange={onOpenChange} />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await screen.findByDisplayValue("Carol");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(vi.mocked(updateUser)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateUser).mock.calls[0]).toEqual([
      "u1",
      { name: "Carol", email: "carol@example.com", password: "" },
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users"] });
  });

  it("sends the new password when one is provided", async () => {
    const user = userEvent.setup();
    vi.mocked(updateUser).mockResolvedValue(USER);
    renderWithClient(<EditUserDialog user={USER} open onOpenChange={() => {}} />);
    await screen.findByDisplayValue("Carol");

    await user.type(screen.getByLabelText("Password"), "brandnewpass");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(vi.mocked(updateUser)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateUser).mock.calls[0]).toEqual([
      "u1",
      { name: "Carol", email: "carol@example.com", password: "brandnewpass" },
    ]);
  });

  it("rejects a too-short new password", async () => {
    const user = userEvent.setup();
    renderWithClient(<EditUserDialog user={USER} open onOpenChange={() => {}} />);
    await screen.findByDisplayValue("Carol");

    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(vi.mocked(updateUser)).not.toHaveBeenCalled();
  });

  it("shows a duplicate-email message and stays open on 409", async () => {
    const user = userEvent.setup();
    vi.mocked(updateUser).mockRejectedValue(new ApiError(409, "409 Conflict"));
    const onOpenChange = vi.fn();
    renderWithClient(<EditUserDialog user={USER} open onOpenChange={onOpenChange} />);
    await screen.findByDisplayValue("Carol");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("A user with that email already exists.")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

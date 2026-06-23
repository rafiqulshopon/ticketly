import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { UserListItem } from "@ticketly/shared";
import { ApiError, createUser, updateUser } from "@/lib/api";
import { UserFormDialog } from "./user-form-dialog";

// The api client is mocked so tests never hit the network. `ApiError` stays the
// real class (via importOriginal) so the dialog's `instanceof` checks still work.
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, createUser: vi.fn(), updateUser: vi.fn() };
});

const SAVED: UserListItem = {
  id: "u1",
  name: "Carol",
  email: "carol@example.com",
  role: "agent",
  emailVerified: false,
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

beforeEach(() => {
  vi.mocked(createUser).mockReset();
  vi.mocked(updateUser).mockReset();
});

describe("UserFormDialog — create mode", () => {
  it("renders nothing when closed and shows the form when open", () => {
    renderWithClient(<UserFormDialog mode="create" open={false} onOpenChange={() => {}} />);
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();

    renderWithClient(<UserFormDialog mode="create" open onOpenChange={() => {}} />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("blocks submit and shows name/password errors on an empty form", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithClient(<UserFormDialog mode="create" open onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("Name must be at least 3 characters")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    const user = userEvent.setup();
    renderWithClient(<UserFormDialog mode="create" open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("Enter a valid email")).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("rejects whitespace in the password and outer whitespace in the name", async () => {
    const user = userEvent.setup();
    renderWithClient(<UserFormDialog mode="create" open onOpenChange={() => {}} />);

    await user.type(screen.getByLabelText("Name"), "  Carol  ");
    await user.type(screen.getByLabelText("Email"), "carol@example.com");
    await user.type(screen.getByLabelText("Password"), "super secret");
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("Name cannot start or end with a space")).toBeInTheDocument();
    expect(screen.getByText("Password cannot contain spaces")).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("creates the user, invalidates the list, and closes on success", async () => {
    const user = userEvent.setup();
    vi.mocked(createUser).mockResolvedValue(SAVED);
    const onOpenChange = vi.fn();
    const { queryClient } = renderWithClient(
      <UserFormDialog mode="create" open onOpenChange={onOpenChange} />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await user.type(screen.getByLabelText("Name"), "Carol");
    await user.type(screen.getByLabelText("Email"), "carol@example.com");
    await user.type(screen.getByLabelText("Password"), "supersecret");
    await user.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(createUser).toHaveBeenCalledTimes(1);
    // TanStack Query passes a context object as the 2nd arg to mutationFn, so
    // assert only on the submitted payload (the 1st arg). `vi.mocked()` casts to
    // the Mock type so `.mock` is visible (the import is typed as the real fn).
    expect(vi.mocked(createUser).mock.calls[0][0]).toEqual({
      name: "Carol",
      email: "carol@example.com",
      password: "supersecret",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users"] });
  });

  it("shows a duplicate-email message and stays open on 409", async () => {
    const user = userEvent.setup();
    vi.mocked(createUser).mockRejectedValue(new ApiError(409, "409 Conflict"));
    const onOpenChange = vi.fn();
    renderWithClient(<UserFormDialog mode="create" open onOpenChange={onOpenChange} />);

    await user.type(screen.getByLabelText("Name"), "Carol");
    await user.type(screen.getByLabelText("Email"), "carol@example.com");
    await user.type(screen.getByLabelText("Password"), "supersecret");
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText("A user with that email already exists.")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(createUser).toHaveBeenCalledTimes(1);
  });
});

describe("UserFormDialog — edit mode", () => {
  it("pre-fills name and email (password blank) when opened", async () => {
    renderWithClient(<UserFormDialog mode="edit" user={SAVED} open onOpenChange={() => {}} />);
    expect(await screen.findByDisplayValue("Carol")).toBeInTheDocument();
    expect(screen.getByDisplayValue("carol@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("saves name/email and leaves the password unchanged when blank", async () => {
    const user = userEvent.setup();
    vi.mocked(updateUser).mockResolvedValue(SAVED);
    const onOpenChange = vi.fn();
    const { queryClient } = renderWithClient(
      <UserFormDialog mode="edit" user={SAVED} open onOpenChange={onOpenChange} />,
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
    vi.mocked(updateUser).mockResolvedValue(SAVED);
    renderWithClient(<UserFormDialog mode="edit" user={SAVED} open onOpenChange={() => {}} />);
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
    renderWithClient(<UserFormDialog mode="edit" user={SAVED} open onOpenChange={() => {}} />);
    await screen.findByDisplayValue("Carol");

    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("shows a duplicate-email message and stays open on 409", async () => {
    const user = userEvent.setup();
    vi.mocked(updateUser).mockRejectedValue(new ApiError(409, "409 Conflict"));
    const onOpenChange = vi.fn();
    renderWithClient(<UserFormDialog mode="edit" user={SAVED} open onOpenChange={onOpenChange} />);
    await screen.findByDisplayValue("Carol");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("A user with that email already exists.")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

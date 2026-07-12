/// <reference types="jest" />
// errors.ts only needs the ApiError class from @/lib/api, but that module pulls
// in @/lib/auth → better-auth/react (ESM .mjs that jest-expo doesn't transform).
// Mock the auth module to break that chain (same per-file pattern as the lucide
// mock in notification-item.test). ApiError itself is self-contained.
jest.mock("@/lib/auth", () => ({
  authClient: { getCookie: () => "" },
  API_ORIGIN: "http://localhost:3000",
}));
import { ApiError } from "@/lib/api";
import { toErrorMessage } from "./errors";

describe("toErrorMessage", () => {
  it("maps 401 to a session-expired message", () => {
    expect(toErrorMessage(new ApiError(401, "401 Unauthorized"))).toMatch(/session may have expired/);
  });

  it("maps 403 to a permission message", () => {
    expect(toErrorMessage(new ApiError(403, "403 Forbidden"))).toMatch(/permission/);
  });

  it("maps 404 to a not-found message", () => {
    expect(toErrorMessage(new ApiError(404, "404 Not Found"))).toMatch(/couldn't find/);
  });

  it("falls back to the ApiError's own message for other HTTP statuses", () => {
    expect(toErrorMessage(new ApiError(500, "500 Internal Server Error"))).toBe(
      "500 Internal Server Error",
    );
  });

  it("uses the custom fallback when an ApiError carries no message", () => {
    expect(toErrorMessage(new ApiError(500, ""), "Custom fallback")).toBe("Custom fallback");
  });

  it("returns the default fallback for a non-Error thrown value", () => {
    expect(toErrorMessage("a plain string")).toBe("Something went wrong.");
  });

  it("returns the error's message for a generic Error", () => {
    expect(toErrorMessage(new Error("Network failed"))).toBe("Network failed");
  });
});

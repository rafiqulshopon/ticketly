import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// `globals: false` disables RTL's auto-cleanup hook, so unmount between tests.
afterEach(() => {
  cleanup();
});

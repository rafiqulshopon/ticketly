import { describe, expect, it } from "vitest";
import { formatDuration } from "./format";

describe("formatDuration", () => {
  it("returns an em dash for null/undefined/NaN", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
  });

  it("formats zero and sub-minute durations as seconds", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(12_000)).toBe("12s");
  });

  it("formats minutes with remaining seconds", () => {
    expect(formatDuration(45 * 60_000 + 10_000)).toBe("45m 10s");
  });

  it("formats hours with remaining minutes", () => {
    expect(formatDuration(3 * 3_600_000 + 15 * 60_000)).toBe("3h 15m");
  });

  it("formats days with remaining hours", () => {
    expect(formatDuration(2 * 86_400_000 + 4 * 3_600_000)).toBe("2d 4h");
  });

  it("rounds milliseconds to the nearest second", () => {
    expect(formatDuration(12_500)).toBe("13s");
  });
});

/// <reference types="jest" />
import { ticketStatusEnum, priorityEnum } from "@ticketly/shared";
import { prettifyEnum, PRIORITY_BADGES, STATUS_BADGES } from "./ticket-badges";

describe("prettifyEnum", () => {
  it("lowercases and replaces underscores with spaces", () => {
    expect(prettifyEnum("GENERAL_QUESTION")).toBe("General question");
    expect(prettifyEnum("TECHNICAL_QUESTION")).toBe("Technical question");
  });

  it("capitalizes the first letter", () => {
    expect(prettifyEnum("refund_request")).toBe("Refund request");
  });
});

describe("STATUS_BADGES", () => {
  // A Record over the status union forces a badge for every status — assert the
  // map stays complete as the enum evolves.
  it("maps every ticket status to a label + variant", () => {
    for (const status of ticketStatusEnum.options) {
      const badge = STATUS_BADGES[status];
      expect(badge).toBeDefined();
      expect(typeof badge.label).toBe("string");
      expect(badge.label.length).toBeGreaterThan(0);
    }
  });

  it("labels the lifecycle states", () => {
    expect(STATUS_BADGES.NEW.label).toBe("New");
    expect(STATUS_BADGES.AWAITING_STUDENT.label).toBe("Awaiting");
    expect(STATUS_BADGES.RESOLVED.label).toBe("Resolved");
  });
});

describe("PRIORITY_BADGES", () => {
  it("maps every priority", () => {
    for (const priority of priorityEnum.options) {
      expect(PRIORITY_BADGES[priority]).toBeDefined();
    }
  });

  it("flags high priority with the danger variant", () => {
    expect(PRIORITY_BADGES.HIGH.variant).toBe("danger");
    expect(PRIORITY_BADGES.NORMAL.variant).toBe("outline");
  });
});

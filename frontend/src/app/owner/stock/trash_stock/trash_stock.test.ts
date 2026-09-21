import { describe, expect, it } from "vitest";
import { isWithinTrashRetention } from "./trash_stock";

describe("isWithinTrashRetention", () => {
  it("returns true if deletedAt is missing or empty", () => {
    expect(isWithinTrashRetention(undefined)).toBe(true);
    expect(isWithinTrashRetention("")).toBe(true);
  });

  it("returns true if deleted within 14 days", () => {
    const today = new Date().toISOString();
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const thirteenDaysAgo = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString();

    expect(isWithinTrashRetention(today)).toBe(true);
    expect(isWithinTrashRetention(fiveDaysAgo)).toBe(true);
    expect(isWithinTrashRetention(thirteenDaysAgo)).toBe(true);
  });

  it("returns false if deleted more than 14 days ago", () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    expect(isWithinTrashRetention(fifteenDaysAgo)).toBe(false);
    expect(isWithinTrashRetention(thirtyDaysAgo)).toBe(false);
  });
});

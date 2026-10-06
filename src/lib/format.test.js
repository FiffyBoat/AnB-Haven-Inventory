import { describe, it, expect } from "vitest";
import { formatGhs, formatInt, formatDate, formatDateTime, isToday, clientTxId } from "./format";

describe("format helpers", () => {
  it("formats Ghana Cedis (formatGhs) accurately", () => {
    expect(formatGhs(1500)).toContain("1,500.00");
    expect(formatGhs(0)).toContain("0.00");
    expect(formatGhs("49.9")).toContain("49.90");
    expect(formatGhs(null)).toContain("0.00");
    expect(formatGhs(undefined)).toContain("0.00");
    expect(formatGhs(12.345)).toContain("12.35");
  });

  it("formats integers correctly (formatInt)", () => {
    expect(formatInt(1250000)).toBe((1250000).toLocaleString());
    expect(formatInt(0)).toBe("0");
    expect(formatInt("42")).toBe("42");
    expect(formatInt(null)).toBe("0");
  });

  it("identifies today's date (isToday)", () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000 * 2).toISOString();
    expect(isToday(today)).toBe(true);
    expect(isToday(yesterday)).toBe(false);
    expect(isToday(null)).toBe(false);
  });

  it("generates a client transaction ID (clientTxId)", () => {
    const id1 = clientTxId();
    const id2 = clientTxId();
    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThan(5);
    expect(id1).not.toBe(id2);
  });
});

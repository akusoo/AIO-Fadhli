import { describe, expect, it } from "vitest";
import {
  cn,
  createId,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatDateRange,
  formatNumberInput,
  parseNumberInput,
} from "@/lib/utils";

describe("utils helpers", () => {
  it("joins conditional class names", () => {
    expect(cn("base", false, "accent", null, undefined)).toBe("base accent");
  });

  it("formats currency and numeric inputs for Indonesian locale", () => {
    expect(formatCurrency(125000)).toContain("Rp");
    expect(formatCompactCurrency(1_250_000)).toContain("Rp");
    expect(formatNumberInput("12abc500")).toBe("12.500");
    expect(parseNumberInput("12.500")).toBe(12500);
  });

  it("formats date helpers and generates prefixed ids", () => {
    expect(formatDate("2026-04-02")).toMatch(/2 Apr 2026/i);
    expect(formatDateRange("2026-04-01", "2026-04-02")).toMatch(/2026/);
    expect(createId("task")).toMatch(/^task-/);
  });
});

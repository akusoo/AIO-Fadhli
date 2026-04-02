import { describe, expect, it, vi } from "vitest";
import {
  buildTelegramBudgetMessage,
  buildTelegramDebtMessage,
  buildTelegramDigest,
  buildTelegramHelpMessage,
  buildTelegramTodayMessage,
} from "@/lib/reminders/telegram";
import { cloneSnapshot } from "../support/factories";

describe("telegram reminder builders", () => {
  it("builds digest, today, debt, and budget summaries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T00:00:00.000Z"));

    const snapshot = cloneSnapshot();

    expect(buildTelegramDigest(snapshot, "2026-04-02")).toContain("Ringkasan AIO Personal Tracker");
    expect(buildTelegramTodayMessage(snapshot, "2026-04-02")).toContain("Task fokus hari ini");
    expect(buildTelegramDebtMessage(snapshot)).toContain("Ringkasan cicilan");
    expect(buildTelegramBudgetMessage(snapshot)).toContain("Ringkasan budget");
    expect(buildTelegramHelpMessage()).toContain("/digest");
  });
});

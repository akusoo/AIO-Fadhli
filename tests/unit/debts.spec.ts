import { describe, expect, it, vi } from "vitest";
import {
  getEffectiveInstallmentStatus,
  getInstallmentPaymentAmount,
  getNearestInstallment,
  getOpenInstallments,
  recomputeDebtSummaries,
  resolveAutomaticDebtStatus,
} from "@/lib/debts";
import { cloneSnapshot, makeInstallment } from "../support/factories";

describe("debts helpers", () => {
  it("resolves automatic debt status based on today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T00:00:00.000Z"));

    expect(resolveAutomaticDebtStatus("2026-04-01")).toBe("overdue");
    expect(resolveAutomaticDebtStatus("2026-04-05")).toBe("watch");
    expect(resolveAutomaticDebtStatus("2026-04-20")).toBe("healthy");
  });

  it("prefers manual installment status and computes payment amount", () => {
    const manualInstallment = makeInstallment({
      status: "paid",
      statusSource: "manual",
      lateFeeAmount: 25_000,
    });

    expect(getEffectiveInstallmentStatus(manualInstallment)).toBe("paid");
    expect(getInstallmentPaymentAmount(manualInstallment)).toBe(275_000);
  });

  it("recomputes debt summaries from unpaid installments", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T00:00:00.000Z"));

    const snapshot = cloneSnapshot();
    recomputeDebtSummaries(snapshot.debts, snapshot.debtInstallments, snapshot.debtPayments);

    const overdueDebt = snapshot.debts.find((debt) => debt.id === "debt-03");
    expect(overdueDebt?.status).toBe("overdue");
    expect(overdueDebt?.remainingAmount).toBeGreaterThan(0);

    const paidInstallments = snapshot.debtInstallments.filter(
      (installment) => getEffectiveInstallmentStatus(installment) === "paid",
    );
    expect(paidInstallments.length).toBeGreaterThan(0);
  });

  it("returns open installments ordered by nearest due date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T00:00:00.000Z"));

    const snapshot = cloneSnapshot();
    const openInstallments = getOpenInstallments(snapshot);

    expect(openInstallments.length).toBeGreaterThan(0);
    expect(getNearestInstallment(snapshot)?.id).toBe(openInstallments[0]?.id);
    expect(openInstallments.every((installment) => installment.status !== "paid")).toBe(true);
  });
});

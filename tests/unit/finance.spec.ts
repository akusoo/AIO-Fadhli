import { describe, expect, it } from "vitest";
import {
  buildCategoryBudgetSummary,
  filterTransactions,
  getFinanceOverview,
  getForecastItems,
  getMonthlyCategorySpendPoints,
  getTransactionTags,
  getUpcomingFinanceItems,
} from "@/lib/finance";
import { cloneSnapshot } from "../support/factories";

describe("finance helpers", () => {
  it("builds finance overview from active cycle and monthly transactions", () => {
    const snapshot = cloneSnapshot();
    const overview = getFinanceOverview(snapshot, "2026-03");

    expect(overview.activeCycleId).toBe("cycle-01");
    expect(overview.availableCash).toBe(
      snapshot.accounts.reduce((sum, account) => sum + account.balance, 0),
    );
    expect(overview.monthIncome).toBeGreaterThan(0);
    expect(overview.monthExpense).toBeGreaterThan(0);
  });

  it("filters transactions by search, account, tag, and month", () => {
    const snapshot = cloneSnapshot();
    const results = filterTransactions(snapshot.transactions, {
      search: "figma",
      accountId: "acct-bca",
      tag: "design",
      month: "2026-03",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Langganan desain");
  });

  it("builds forecast and category budget summaries", () => {
    const snapshot = cloneSnapshot();
    const allocation = snapshot.budgetCategoryAllocations[0];
    const summary = buildCategoryBudgetSummary(snapshot, allocation);
    const forecast = getForecastItems(snapshot, 3);

    expect(summary.allocatedAmount).toBe(allocation.allocatedAmount);
    expect(summary.remainingAmount).toBeTypeOf("number");
    expect(forecast).toHaveLength(3);
    expect(forecast[0]?.projectedBalance).toBeTypeOf("number");
  });

  it("returns upcoming finance items, category spend, and tags", () => {
    const snapshot = cloneSnapshot();

    expect(getUpcomingFinanceItems(snapshot).length).toBeGreaterThan(0);
    expect(getMonthlyCategorySpendPoints(snapshot, "2026-03")[0]?.spentAmount).toBeGreaterThan(0);
    expect(getTransactionTags(snapshot)).toContain("design");
  });
});

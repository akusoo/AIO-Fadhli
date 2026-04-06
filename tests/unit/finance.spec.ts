import { describe, expect, it } from "vitest";
import {
  buildCategoryBudgetSummary,
  filterTransactions,
  getFinanceOverview,
  getForecastItems,
  getInvestmentAllocationByPlatform,
  getInvestmentSummary,
  getInvestmentTopGainers,
  getInvestmentTopLosers,
  getInvestmentTrend,
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

  it("builds investment summary, allocations, trend, and leaderboards", () => {
    const snapshot = cloneSnapshot();
    const summary = getInvestmentSummary(snapshot);
    const byPlatform = getInvestmentAllocationByPlatform(snapshot);
    const trend = getInvestmentTrend(snapshot);
    const gainers = getInvestmentTopGainers(snapshot, 2);
    const losers = getInvestmentTopLosers(snapshot, 2);

    expect(summary.investedAmount).toBeGreaterThan(0);
    expect(summary.currentValue).toBeGreaterThan(0);
    expect(byPlatform[0]?.value).toBeGreaterThan(0);
    expect(trend.length).toBeGreaterThan(0);
    expect(gainers).toHaveLength(2);
    expect(losers).toHaveLength(2);
  });
});

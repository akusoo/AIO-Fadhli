import type {
  Account,
  AppSnapshot,
  BudgetCategoryAllocation,
  CashflowPoint,
  CategorySpendPoint,
  FinanceOverview,
  Investment,
  InvestmentValuation,
  RecurringPlan,
  Transaction,
  UpcomingFinanceItem,
} from "@/lib/domain/models";
import { getOpenInstallments, getInstallmentPaymentAmount } from "@/lib/debts";

function formatShortLabel(dateText: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(new Date(dateText));
}

function monthKey(dateText: string) {
  return dateText.slice(0, 7);
}

function buildCashflowPoints(transactions: Transaction[]) {
  const grouped = new Map<string, CashflowPoint>();

  transactions.forEach((transaction) => {
    const key = transaction.occurredOn;
    const current = grouped.get(key) ?? {
      id: key,
      label: formatShortLabel(key),
      income: 0,
      expense: 0,
      net: 0,
    };

    if (transaction.kind === "income") {
      current.income += transaction.amount;
      current.net += transaction.amount;
    }

    if (transaction.kind === "expense") {
      current.expense += transaction.amount;
      current.net -= transaction.amount;
    }

    grouped.set(key, current);
  });

  return Array.from(grouped.values()).sort((left, right) => left.id.localeCompare(right.id));
}

export function getActiveCycle(snapshot: AppSnapshot) {
  return (snapshot.budgetCycles ?? []).find((cycle) => cycle.status === "active");
}

export function getAvailableCash(snapshot: AppSnapshot) {
  return (snapshot.accounts ?? []).reduce((sum, account) => sum + account.balance, 0);
}

export function getMonthTransactions(snapshot: AppSnapshot, month = "2026-03") {
  return (snapshot.transactions ?? []).filter((transaction) =>
    transaction.occurredOn.startsWith(month),
  );
}

export function getFinanceOverview(
  snapshot: AppSnapshot,
  month = "2026-03",
): FinanceOverview {
  const activeCycle = getActiveCycle(snapshot);
  const monthTransactions = getMonthTransactions(snapshot, month);
  const monthIncome = monthTransactions
    .filter((transaction) => transaction.kind === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const monthExpense = monthTransactions
    .filter((transaction) => transaction.kind === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const upcomingItems = getUpcomingFinanceItems(snapshot);

  return {
    availableCash: getAvailableCash(snapshot),
    monthIncome,
    monthExpense,
    monthNet: monthIncome - monthExpense,
    activeCycleId: activeCycle?.id,
    activeCycleSpent: activeCycle?.spentAmount,
    activeCycleTarget: activeCycle?.targetAmount,
    upcomingTotal: upcomingItems.reduce((sum, item) => sum + item.amount, 0),
    upcomingCount: upcomingItems.length,
  };
}

export function getBudgetCategoryPoints(
  snapshot: AppSnapshot,
  cycleId?: string,
): CategorySpendPoint[] {
  const targetCycleId = cycleId ?? getActiveCycle(snapshot)?.id;

  if (!targetCycleId) {
    return [];
  }

  const allocations = (snapshot.budgetCategoryAllocations ?? []).filter(
    (allocation) => allocation.cycleId === targetCycleId,
  );

  return allocations.map((allocation) => {
    const category = (snapshot.categories ?? []).find(
      (item) => item.id === allocation.categoryId,
    );
    const spentAmount = (snapshot.transactions ?? [])
      .filter(
        (transaction) =>
          transaction.cycleId === targetCycleId &&
          transaction.categoryId === allocation.categoryId &&
          transaction.kind === "expense",
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      categoryId: allocation.categoryId,
      label: category?.name ?? allocation.categoryId,
      spentAmount,
      allocatedAmount: allocation.allocatedAmount,
    };
  });
}

export function getUpcomingFinanceItems(snapshot: AppSnapshot) {
  const recurringItems: UpcomingFinanceItem[] = (snapshot.recurringPlans ?? [])
    .filter((plan) => plan.enabled)
    .map((plan) => ({
      id: plan.id,
      label: plan.label,
      type: plan.kind,
      amount: plan.amount,
      dueOn: plan.nextOccurrenceOn,
      source: "recurring",
      detail: `${plan.cadence} • ${resolveAccountName(snapshot.accounts ?? [], plan.accountId)}`,
    }));

  const debtItems = getOpenInstallments(snapshot).reduce<UpcomingFinanceItem[]>(
    (items, installment) => {
      const debt = snapshot.debts.find((item) => item.id === installment.debtId);

      if (!debt) {
        return items;
      }

      items.push({
        id: `due-${installment.id}`,
        label: `${debt.name} • cicilan ${installment.installmentNumber}`,
        type: "debt_due" as const,
        amount: getInstallmentPaymentAmount(installment),
        dueOn: installment.dueOn,
        source: "debt" as const,
        detail: `${debt.lender} • sisa ${debt.remainingMonths} / ${debt.totalMonths}`,
      });

      return items;
    },
    [],
  );

  return [...recurringItems, ...debtItems].sort((left, right) =>
    left.dueOn.localeCompare(right.dueOn),
  );
}

export function getCashflowPoints(snapshot: AppSnapshot, month = "2026-03"): CashflowPoint[] {
  return buildCashflowPoints(getMonthTransactions(snapshot, month));
}

export function getCycleCashflowPoints(snapshot: AppSnapshot, cycleId?: string): CashflowPoint[] {
  if (!cycleId) {
    return [];
  }

  return buildCashflowPoints(
    (snapshot.transactions ?? []).filter((transaction) => transaction.cycleId === cycleId),
  );
}

export function getMonthlyCategorySpendPoints(
  snapshot: AppSnapshot,
  month = "2026-03",
): CategorySpendPoint[] {
  const expenseTransactions = getMonthTransactions(snapshot, month).filter(
    (transaction) => transaction.kind === "expense",
  );

  return (snapshot.categories ?? [])
    .filter((category) => category.kind === "expense")
    .map((category) => ({
      categoryId: category.id,
      label: category.name,
      spentAmount: expenseTransactions
        .filter((transaction) => transaction.categoryId === category.id)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    }))
    .filter((point) => point.spentAmount > 0)
    .sort((left, right) => right.spentAmount - left.spentAmount);
}

export function getTransactionTags(snapshot: AppSnapshot) {
  return Array.from(
    new Set(
      (snapshot.transactions ?? []).flatMap((transaction) => transaction.tags ?? []),
    ),
  ).sort();
}

export function filterTransactions(
  transactions: Transaction[],
  filters: {
    search?: string;
    kind?: string;
    accountId?: string;
    categoryId?: string;
    merchant?: string;
    tag?: string;
    month?: string;
    occurredOn?: string;
  },
) {
  const searchText = filters.search?.trim().toLowerCase();

  return transactions.filter((transaction) => {
    const matchesSearch = searchText
      ? [
          transaction.title,
          transaction.note,
          transaction.merchant,
          ...(transaction.tags ?? []),
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(searchText))
      : true;

    const matchesKind = filters.kind && filters.kind !== "all"
      ? transaction.kind === filters.kind
      : true;
    const matchesAccount =
      filters.accountId && filters.accountId !== "all"
        ? transaction.accountId === filters.accountId
        : true;
    const matchesCategory =
      filters.categoryId && filters.categoryId !== "all"
        ? transaction.categoryId === filters.categoryId
        : true;
    const matchesMerchant =
      filters.merchant && filters.merchant !== "all"
        ? transaction.merchant === filters.merchant
        : true;
    const matchesTag =
      filters.tag && filters.tag !== "all"
        ? (transaction.tags ?? []).includes(filters.tag)
        : true;
    const matchesMonth =
      filters.month && filters.month !== "all"
        ? monthKey(transaction.occurredOn) === filters.month
        : true;
    const matchesDate = filters.occurredOn
      ? transaction.occurredOn === filters.occurredOn
      : true;

    return (
      matchesSearch &&
      matchesKind &&
      matchesAccount &&
      matchesCategory &&
      matchesMerchant &&
      matchesTag &&
      matchesMonth &&
      matchesDate
    );
  });
}

export function getAccountMovement(
  snapshot: AppSnapshot,
  accountId: string,
  limit = 4,
) {
  return (snapshot.transactions ?? [])
    .filter(Boolean)
    .filter(
      (transaction) =>
        transaction.accountId === accountId ||
        transaction.transferTargetAccountId === accountId,
    )
    .slice(0, limit);
}

export function getForecastItems(snapshot: AppSnapshot, limit = 6) {
  const baseBalance = getAvailableCash(snapshot);

  return getUpcomingFinanceItems(snapshot)
    .slice(0, limit)
    .reduce<
      Array<
        UpcomingFinanceItem & {
          projectedBalance: number;
        }
      >
    >((items, item, index) => {
      const previousBalance = index === 0 ? baseBalance : items[index - 1].projectedBalance;
      const delta =
        item.type === "income" ? item.amount : item.type === "expense" || item.type === "debt_due" ? -item.amount : 0;

      items.push({
        ...item,
        projectedBalance: previousBalance + delta,
      });

      return items;
    }, []);
}

export function resolveAccountName(accounts: Account[], accountId: string) {
  return accounts.find((account) => account.id === accountId)?.name ?? accountId;
}

export function getMerchants(transactions: Transaction[]) {
  return Array.from(
    new Set(transactions.map((transaction) => transaction.merchant).filter(Boolean)),
  ) as string[];
}

export function getMonths(snapshot: AppSnapshot) {
  return Array.from(
    new Set((snapshot.transactions ?? []).map((transaction) => monthKey(transaction.occurredOn))),
  ).sort();
}

export function getRecurringByType(plans: RecurringPlan[], kind: "income" | "expense") {
  return plans.filter((plan) => plan.kind === kind);
}

export function getAllocation(snapshot: AppSnapshot, cycleId: string, categoryId: string) {
  return (snapshot.budgetCategoryAllocations ?? []).find(
    (allocation) =>
      allocation.cycleId === cycleId && allocation.categoryId === categoryId,
  );
}

export function buildCategoryBudgetSummary(
  snapshot: AppSnapshot,
  allocation: BudgetCategoryAllocation,
) {
  const category = (snapshot.categories ?? []).find(
    (item) => item.id === allocation.categoryId,
  );
  const spentAmount = (snapshot.transactions ?? [])
    .filter(
      (transaction) =>
        transaction.cycleId === allocation.cycleId &&
        transaction.categoryId === allocation.categoryId &&
        transaction.kind === "expense",
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    categoryId: allocation.categoryId,
    label: category?.name ?? allocation.categoryId,
    allocatedAmount: allocation.allocatedAmount,
    spentAmount,
    remainingAmount: allocation.allocatedAmount - spentAmount,
    isOverspent: spentAmount > allocation.allocatedAmount,
  };
}

export function getInvestmentSummary(snapshot: AppSnapshot) {
  const investments = snapshot.investments ?? [];
  const investedAmount = investments.reduce((sum, item) => sum + item.investedAmount, 0);
  const currentValue = investments.reduce((sum, item) => sum + item.currentValue, 0);
  const gainLoss = currentValue - investedAmount;
  const gainLossPercent = investedAmount > 0 ? (gainLoss / investedAmount) * 100 : 0;

  return {
    investedAmount,
    currentValue,
    gainLoss,
    gainLossPercent,
    activeCount: investments.filter((item) => item.status === "active").length,
  };
}

export function getInvestmentAllocationByPlatform(snapshot: AppSnapshot) {
  const grouped = new Map<string, number>();

  (snapshot.investments ?? []).forEach((item) => {
    grouped.set(item.platform, (grouped.get(item.platform) ?? 0) + item.currentValue);
  });

  return Array.from(grouped.entries())
    .map(([platform, value]) => ({ platform, value }))
    .sort((left, right) => right.value - left.value);
}

export function getInvestmentAllocationByInstrument(snapshot: AppSnapshot) {
  const grouped = new Map<string, number>();

  (snapshot.investments ?? []).forEach((item) => {
    grouped.set(item.instrument, (grouped.get(item.instrument) ?? 0) + item.currentValue);
  });

  return Array.from(grouped.entries())
    .map(([instrument, value]) => ({ instrument, value }))
    .sort((left, right) => right.value - left.value);
}

export function getInvestmentDistributionByAccount(snapshot: AppSnapshot) {
  const grouped = new Map<string, number>();

  (snapshot.investments ?? []).forEach((item) => {
    grouped.set(item.accountId, (grouped.get(item.accountId) ?? 0) + item.currentValue);
  });

  return Array.from(grouped.entries())
    .map(([accountId, value]) => ({
      accountId,
      accountName: resolveAccountName(snapshot.accounts ?? [], accountId),
      value,
    }))
    .sort((left, right) => right.value - left.value);
}

type LeaderboardRow = {
  id: string;
  name: string;
  gainLoss: number;
  gainLossPercent: number;
  investedAmount: number;
  currentValue: number;
};

function toLeaderboardRow(item: Investment): LeaderboardRow {
  const gainLoss = item.currentValue - item.investedAmount;
  return {
    id: item.id,
    name: item.name,
    gainLoss,
    gainLossPercent: item.investedAmount > 0 ? (gainLoss / item.investedAmount) * 100 : 0,
    investedAmount: item.investedAmount,
    currentValue: item.currentValue,
  };
}

export function getInvestmentTopGainers(snapshot: AppSnapshot, limit = 5) {
  return (snapshot.investments ?? [])
    .map(toLeaderboardRow)
    .sort((left, right) => right.gainLoss - left.gainLoss)
    .slice(0, limit);
}

export function getInvestmentTopLosers(snapshot: AppSnapshot, limit = 5) {
  return (snapshot.investments ?? [])
    .map(toLeaderboardRow)
    .sort((left, right) => left.gainLoss - right.gainLoss)
    .slice(0, limit);
}

function latestValueUntil(valuations: InvestmentValuation[], investmentId: string, date: string) {
  let latest: InvestmentValuation | undefined;

  valuations.forEach((valuation) => {
    if (valuation.investmentId !== investmentId || valuation.valuedOn > date) {
      return;
    }

    if (!latest || valuation.valuedOn > latest.valuedOn) {
      latest = valuation;
    }
  });

  return latest?.currentValue;
}

export function getInvestmentTrend(snapshot: AppSnapshot) {
  const valuations = (snapshot.investmentValuations ?? []).slice();
  const dates = Array.from(new Set(valuations.map((item) => item.valuedOn))).sort();

  return dates.map((date) => {
    const total = (snapshot.investments ?? []).reduce((sum, investment) => {
      const value = latestValueUntil(valuations, investment.id, date) ?? investment.currentValue;
      return sum + value;
    }, 0);

    return {
      id: date,
      label: formatShortLabel(date),
      value: total,
    };
  });
}

import { initialAppSnapshot } from "@/lib/data/mock-data";
import type {
  AddTransactionInput,
  AppSnapshot,
  DebtInstallment,
  Task,
} from "@/lib/domain/models";

export function cloneSnapshot(snapshot: AppSnapshot = initialAppSnapshot): AppSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as AppSnapshot;
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-test",
    title: "Task test",
    status: "todo",
    priority: "medium",
    dueOn: "2026-04-02",
    ...overrides,
  };
}

export function makeInstallment(overrides: Partial<DebtInstallment> = {}): DebtInstallment {
  return {
    id: "inst-test",
    debtId: "debt-test",
    installmentNumber: 1,
    dueOn: "2026-04-02",
    amount: 250_000,
    lateFeeAmount: 0,
    status: "healthy",
    statusSource: "auto",
    ...overrides,
  };
}

export function makeExpenseInput(overrides: Partial<AddTransactionInput> = {}): AddTransactionInput {
  return {
    title: "Belanja test",
    kind: "expense",
    amount: 125_000,
    occurredOn: "2026-03-29",
    accountId: "acct-bca",
    categoryId: "cat-food",
    cycleId: "cycle-01",
    ...overrides,
  };
}

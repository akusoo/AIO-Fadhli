"use client";

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AddDebtInput,
  AddRecurringPlanInput,
  AddNoteInput,
  AddProjectInput,
  AddShoppingItemInput,
  AddSubtaskInput,
  AddTaskInput,
  AddTransactionInput,
  AddWishInput,
  AppSnapshot,
  Note,
  NoteLink,
  NoteLinkType,
  PayDebtInput,
  Project,
  SetNoteLinksInput,
  SetShoppingStatusInput,
  SetWishStatusInput,
  Subtask,
  Task,
  TaskStatus,
  UpdateNoteInput,
  UpdateShoppingItemInput,
  UpdateSubtaskInput,
  UpdateDebtInstallmentInput,
  UpdateDebtInstallmentStatusInput,
  UpdateTaskInput,
  UpdateWishInput,
} from "@/lib/domain/models";
import { initialAppSnapshot } from "@/lib/data/mock-data";
import {
  getEffectiveInstallmentStatus,
  getInstallmentPaymentAmount,
  recomputeDebtSummaries,
} from "@/lib/debts";
import { advanceRecurringTask } from "@/lib/tasks";
import { createId, isoToday } from "@/lib/utils";

type AppStateContextValue = {
  snapshot: AppSnapshot;
  isHydrated: boolean;
  addTransaction(input: AddTransactionInput): Promise<void>;
  addRecurringPlan(input: AddRecurringPlanInput): Promise<void>;
  addDebt(input: AddDebtInput): Promise<void>;
  payDebt(input: PayDebtInput): Promise<void>;
  setDebtInstallmentStatus(input: UpdateDebtInstallmentStatusInput): Promise<void>;
  updateDebtInstallment(input: UpdateDebtInstallmentInput): Promise<void>;
  addProject(input: AddProjectInput): Promise<Project>;
  addTask(input: AddTaskInput): Promise<Task>;
  updateTask(input: UpdateTaskInput): Promise<void>;
  moveTask(taskId: string, status: TaskStatus): Promise<void>;
  toggleTodayPin(taskId: string): Promise<void>;
  addSubtask(input: AddSubtaskInput): Promise<Subtask>;
  updateSubtask(input: UpdateSubtaskInput): Promise<void>;
  toggleSubtask(subtaskId: string): Promise<void>;
  addNote(input: AddNoteInput): Promise<Note>;
  updateNote(input: UpdateNoteInput): Promise<void>;
  setNoteLinks(input: SetNoteLinksInput): Promise<void>;
  addWish(input: AddWishInput): Promise<void>;
  updateWish(input: UpdateWishInput): Promise<void>;
  deleteWish(wishId: string): Promise<void>;
  setWishStatus(input: SetWishStatusInput): Promise<void>;
  moveWishToShopping(wishId: string): Promise<void>;
  addShoppingItem(input: AddShoppingItemInput): Promise<void>;
  updateShoppingItem(input: UpdateShoppingItemInput): Promise<void>;
  deleteShoppingItem(itemId: string): Promise<void>;
  setShoppingStatus(input: SetShoppingStatusInput): Promise<void>;
  recordShoppingPurchase(itemId: string): Promise<void>;
  reset(): Promise<void>;
};

const CACHE_KEY = "aio-personal-tracker-cache-v1";
const OUTBOX_KEY = "aio-personal-tracker-outbox-v1";

const AppStateContext = createContext<AppStateContextValue | null>(null);

type OutboxItem = {
  id: string;
  url: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
};

function cloneSnapshot(snapshot: AppSnapshot) {
  return JSON.parse(JSON.stringify(snapshot)) as AppSnapshot;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function dedupeNoteLinks(links: NoteLink[]) {
  return links.filter(
    (link, index) =>
      links.findIndex((item) => item.type === link.type && item.id === link.id) === index,
  );
}

function normalizeNoteLinks(
  linksInput: unknown,
  legacyLinkedType?: unknown,
  legacyLinkedId?: unknown,
) {
  const normalizedLinks = Array.isArray(linksInput)
    ? linksInput.flatMap((item) => {
        if (
          item &&
          typeof item === "object" &&
          "type" in item &&
          "id" in item &&
          (item.type === "task" || item.type === "project") &&
          typeof item.id === "string"
        ) {
          return [{ type: item.type as NoteLinkType, id: item.id }];
        }

        return [];
      })
    : [];

  if (
    (legacyLinkedType === "task" || legacyLinkedType === "project") &&
    typeof legacyLinkedId === "string"
  ) {
    normalizedLinks.push({
      type: legacyLinkedType,
      id: legacyLinkedId,
    });
  }

  return dedupeNoteLinks(normalizedLinks);
}

function normalizeNotes(notesInput: unknown): Note[] {
  if (!Array.isArray(notesInput)) {
    return cloneValue(initialAppSnapshot.notes);
  }

  return notesInput.flatMap((note, index) => {
    if (!note || typeof note !== "object") {
      return [];
    }

    const candidate = note as {
      id?: unknown;
      title?: unknown;
      content?: unknown;
      links?: unknown;
      linkedType?: unknown;
      linkedId?: unknown;
    };

    if (typeof candidate.title !== "string" || typeof candidate.content !== "string") {
      return [];
    }

    return [
      {
        id:
          typeof candidate.id === "string"
            ? candidate.id
            : `legacy-note-${index + 1}`,
        title: candidate.title,
        content: candidate.content,
        links: normalizeNoteLinks(
          candidate.links,
          candidate.linkedType,
          candidate.linkedId,
        ),
      },
    ];
  });
}

function normalizeSnapshot(snapshot: Partial<AppSnapshot>): AppSnapshot {
  const normalized = {
    ...cloneSnapshot(initialAppSnapshot),
    ...snapshot,
    accounts: snapshot.accounts ?? cloneValue(initialAppSnapshot.accounts),
    categories: snapshot.categories ?? cloneValue(initialAppSnapshot.categories),
    budgetCycles: snapshot.budgetCycles ?? cloneValue(initialAppSnapshot.budgetCycles),
    budgetCategoryAllocations:
      snapshot.budgetCategoryAllocations ??
      cloneValue(initialAppSnapshot.budgetCategoryAllocations),
    transactions: (snapshot.transactions ?? cloneValue(initialAppSnapshot.transactions)).map(
      (transaction) => ({
        tags: [],
        ...transaction,
      }),
    ),
    recurringPlans:
      snapshot.recurringPlans ?? cloneValue(initialAppSnapshot.recurringPlans),
    debts: snapshot.debts ?? cloneValue(initialAppSnapshot.debts),
    debtInstallments:
      snapshot.debtInstallments ?? cloneValue(initialAppSnapshot.debtInstallments),
    debtPayments:
      snapshot.debtPayments ?? cloneValue(initialAppSnapshot.debtPayments),
    projects: snapshot.projects ?? cloneValue(initialAppSnapshot.projects),
    tasks: (snapshot.tasks ?? cloneValue(initialAppSnapshot.tasks)).map((task) => ({
      todayPinned: false,
      note: "",
      startTime: undefined,
      dueTime: undefined,
      reminderAt: undefined,
      completedAt: task.status === "done" ? task.dueOn : undefined,
      recurring: undefined,
      ...task,
    })),
    subtasks: snapshot.subtasks ?? cloneValue(initialAppSnapshot.subtasks),
    notes: normalizeNotes(snapshot.notes),
    wishItems: snapshot.wishItems ?? cloneValue(initialAppSnapshot.wishItems),
    shoppingItems: (snapshot.shoppingItems ?? cloneValue(initialAppSnapshot.shoppingItems)).map(
      (item) => ({
        ...item,
        quantity: item.quantity ?? 1,
        section: item.section ?? "Lainnya",
        store: item.store ?? undefined,
      }),
    ),
    reminderRules:
      snapshot.reminderRules ?? cloneValue(initialAppSnapshot.reminderRules),
  };

  syncDebtSummary(normalized);

  return normalized;
}

function updateAccountBalances(snapshot: AppSnapshot, input: AddTransactionInput) {
  const account = snapshot.accounts.find((item) => item.id === input.accountId);

  if (!account) {
    return;
  }

  if (input.kind === "income") {
    account.balance += input.amount;
  }

  if (input.kind === "expense") {
    account.balance -= input.amount;
  }

  if (input.kind === "transfer") {
    account.balance -= input.amount;
    const target = snapshot.accounts.find(
      (item) => item.id === input.transferTargetAccountId,
    );

    if (target) {
      target.balance += input.amount;
    }
  }
}

function updateCycleSpend(snapshot: AppSnapshot, input: AddTransactionInput) {
  if (!input.cycleId) {
    return;
  }

  const cycle = snapshot.budgetCycles.find((item) => item.id === input.cycleId);

  if (!cycle) {
    return;
  }

  if (input.kind === "expense") {
    cycle.spentAmount += input.amount;
  }

  if (input.kind === "income") {
    cycle.incomeAmount += input.amount;
  }
}

function revertAccountBalances(snapshot: AppSnapshot, input: AddTransactionInput) {
  const account = snapshot.accounts.find((item) => item.id === input.accountId);

  if (!account) {
    return;
  }

  if (input.kind === "income") {
    account.balance -= input.amount;
  }

  if (input.kind === "expense") {
    account.balance += input.amount;
  }

  if (input.kind === "transfer") {
    account.balance += input.amount;
    const target = snapshot.accounts.find(
      (item) => item.id === input.transferTargetAccountId,
    );

    if (target) {
      target.balance -= input.amount;
    }
  }
}

function revertCycleSpend(snapshot: AppSnapshot, input: AddTransactionInput) {
  if (!input.cycleId) {
    return;
  }

  const cycle = snapshot.budgetCycles.find((item) => item.id === input.cycleId);

  if (!cycle) {
    return;
  }

  if (input.kind === "expense") {
    cycle.spentAmount -= input.amount;
  }

  if (input.kind === "income") {
    cycle.incomeAmount -= input.amount;
  }
}

function getDefaultExpenseCategoryId(snapshot: AppSnapshot) {
  return (
    snapshot.categories.find((item) => item.id === "cat-installment")?.id ??
    snapshot.categories.find((item) => item.id === "cat-tools")?.id ??
    snapshot.categories.find((item) => item.kind === "expense")?.id
  );
}

function syncDebtSummary(snapshot: AppSnapshot) {
  recomputeDebtSummaries(snapshot.debts, snapshot.debtInstallments, snapshot.debtPayments);
}

function getDefaultPaymentAccountId(snapshot: AppSnapshot) {
  return (
    snapshot.accounts.find((account) => account.type === "bank")?.id ??
    snapshot.accounts[0]?.id
  );
}

function getActiveCycleId(snapshot: AppSnapshot) {
  return snapshot.budgetCycles.find((cycle) => cycle.status === "active")?.id;
}

function removeInstallmentPaymentArtifacts(snapshot: AppSnapshot, installmentId: string) {
  const linkedTransactions = snapshot.transactions.filter(
    (transaction) =>
      transaction.sourceType === "debt_installment" && transaction.sourceId === installmentId,
  );

  linkedTransactions.forEach((transaction) => {
    revertAccountBalances(snapshot, transaction);
    revertCycleSpend(snapshot, transaction);
  });

  snapshot.debtPayments = snapshot.debtPayments.filter(
    (payment) => payment.installmentId !== installmentId,
  );
  snapshot.transactions = snapshot.transactions.filter(
    (transaction) =>
      !(transaction.sourceType === "debt_installment" && transaction.sourceId === installmentId),
  );
}

function createInstallmentPayment(
  snapshot: AppSnapshot,
  input: { debtId: string; installmentId: string; paidOn: string; note?: string },
) {
  const installment = snapshot.debtInstallments.find(
    (item) => item.id === input.installmentId && item.debtId === input.debtId,
  );
  const debt = snapshot.debts.find((item) => item.id === input.debtId);

  if (!installment || !debt) {
    return;
  }

  const paymentAmount = getInstallmentPaymentAmount(installment);
  installment.status = "paid";
  installment.statusSource = "manual";
  installment.paidOn = input.paidOn;
  installment.note = input.note ?? installment.note;

  syncDebtSummary(snapshot);
  const remainingAmount = snapshot.debts.find((item) => item.id === input.debtId)?.remainingAmount ?? 0;
  snapshot.debtPayments.unshift({
    id: createId("pay"),
    debtId: input.debtId,
    installmentId: input.installmentId,
    amount: paymentAmount,
    paidOn: input.paidOn,
    remainingAmount,
    note: input.note,
  });

  const accountId = getDefaultPaymentAccountId(snapshot);
  const categoryId = getDefaultExpenseCategoryId(snapshot);

  if (!accountId || !categoryId) {
    return;
  }

  const transactionInput: AddTransactionInput = {
    title: `${debt.name} • cicilan ${installment.installmentNumber}`,
    kind: "expense",
    amount: paymentAmount,
    occurredOn: input.paidOn,
    accountId,
    categoryId,
    cycleId: getActiveCycleId(snapshot),
    tags: ["cicilan", debt.name.toLowerCase()],
    note: input.note
      ? `${input.note} • otomatis dari modul hutang`
      : "Otomatis dari modul hutang",
    sourceType: "debt_installment",
    sourceId: installment.id,
  };

  snapshot.transactions.unshift({
    id: createId("trx"),
    ...transactionInput,
  });
  updateAccountBalances(snapshot, transactionInput);
  updateCycleSpend(snapshot, transactionInput);
}

function applyTaskStatus(task: Task, status: TaskStatus) {
  if (status === "done") {
    if (task.recurring) {
      task.completedAt = `${isoToday()}T00:00`;
      advanceRecurringTask(task);
      return;
    }

    task.status = "done";
    task.completedAt = `${isoToday()}T00:00`;
    task.todayPinned = false;
    return;
  }

  task.status = status;
  task.completedAt = undefined;
}

function addMonthsToIsoDate(dateText: string, offset: number) {
  const date = new Date(dateText);
  return new Date(date.getFullYear(), date.getMonth() + offset, date.getDate())
    .toISOString()
    .slice(0, 10);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(cloneSnapshot(initialAppSnapshot));
  const [isHydrated, setIsHydrated] = useState(false);
  const hasLoaded = useRef(false);
  const outboxRef = useRef<OutboxItem[]>([]);

  function applyOptimisticMutation(mutator: (draft: AppSnapshot) => void) {
    setSnapshot((current) => {
      const draft = cloneSnapshot(current);
      mutator(draft);
      return draft;
    });
  }

  function saveOutbox(nextOutbox: OutboxItem[]) {
    outboxRef.current = nextOutbox;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(nextOutbox));
    }
  }

  function enqueueOutbox(item: OutboxItem) {
    saveOutbox([...outboxRef.current, item]);
  }

  async function fetchSnapshot() {
    const response = await fetch("/api/app/boot", {
      cache: "no-store",
      credentials: "same-origin",
    });

    if (response.status === 401) {
      if (typeof window !== "undefined" && window.location.pathname !== "/auth/sign-in") {
        window.location.href = "/auth/sign-in";
      }

      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Gagal memuat snapshot backend.");
    }

    const payload = (await response.json()) as { snapshot: AppSnapshot };
    const normalized = normalizeSnapshot(payload.snapshot);
    setSnapshot(normalized);
    return normalized;
  }

  async function syncMutation<T>(
    url: string,
    method: OutboxItem["method"],
    body?: unknown,
  ): Promise<T | undefined> {
    try {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 401) {
        if (typeof window !== "undefined") {
          window.location.href = "/auth/sign-in";
        }

        throw new Error("Unauthorized");
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Mutasi backend gagal.");
      }

      const payload = (await response.json()) as { snapshot?: AppSnapshot; item?: T };

      if (payload.snapshot) {
        setSnapshot(normalizeSnapshot(payload.snapshot));
      }

      return payload.item;
    } catch (error) {
      const shouldQueue =
        (typeof navigator !== "undefined" && !navigator.onLine) || error instanceof TypeError;

      if (shouldQueue) {
        enqueueOutbox({
          id: createId("outbox"),
          url,
          method,
          body,
        });

        return undefined;
      }

      try {
        await fetchSnapshot();
      } catch {}

      throw error;
    }
  }

  const flushOutbox = useEffectEvent(async () => {
    if (outboxRef.current.length === 0) {
      return;
    }

    const remaining: OutboxItem[] = [];

    for (const [index, item] of outboxRef.current.entries()) {
      try {
        await syncMutation(item.url, item.method, item.body);
      } catch (error) {
        const shouldKeep =
          (typeof navigator !== "undefined" && !navigator.onLine) || error instanceof TypeError;

        if (shouldKeep) {
          remaining.push(...outboxRef.current.slice(index));
          break;
        }
      }
    }

    saveOutbox(remaining);
  });

  useEffect(() => {
    async function bootstrap() {
      if (hasLoaded.current) {
        return;
      }

      hasLoaded.current = true;

      if (typeof window !== "undefined") {
        const cachedSnapshot = window.localStorage.getItem(CACHE_KEY);
        const cachedOutbox = window.localStorage.getItem(OUTBOX_KEY);

        if (cachedSnapshot) {
          setSnapshot(normalizeSnapshot(JSON.parse(cachedSnapshot) as Partial<AppSnapshot>));
          setIsHydrated(true);
        }

        if (cachedOutbox) {
          outboxRef.current = JSON.parse(cachedOutbox) as OutboxItem[];
        }
      }

      try {
        await fetchSnapshot();
        setIsHydrated(true);
        await flushOutbox();
      } catch {
        setIsHydrated(true);
      }
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  }, [isHydrated, snapshot]);

  useEffect(() => {
    function handleOnline() {
      void flushOutbox();
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  async function addTransaction(input: AddTransactionInput) {
    const clientId = createId("trx");

    applyOptimisticMutation((draft) => {
      draft.transactions.unshift({
        id: clientId,
        ...input,
      });
      updateAccountBalances(draft, input);
      updateCycleSpend(draft, input);
    });

    await syncMutation("/api/finance/transactions", "POST", {
      ...input,
      clientId,
    });
  }

  async function addRecurringPlan(input: AddRecurringPlanInput) {
    const clientId = createId("rec");

    applyOptimisticMutation((draft) => {
      draft.recurringPlans.unshift({
        id: clientId,
        ...input,
        enabled: true,
      });
    });

    await syncMutation("/api/finance/recurring-plans", "POST", {
      ...input,
      clientId,
    });
  }

  async function addDebt(input: AddDebtInput) {
    applyOptimisticMutation((draft) => {
      const debtId = createId("debt");
      const resolvedInstallments =
        input.installments?.length
          ? input.installments
          : Array.from({ length: input.totalMonths }, (_, index) => ({
              installmentNumber: index + 1,
              dueOn: addMonthsToIsoDate(input.firstDueOn, index),
              amount: input.installmentAmount,
              lateFeeAmount: input.lateFeeAmount,
              note: input.note,
            }));

      draft.debts.unshift({
        id: debtId,
        name: input.name,
        lender: input.lender,
        principalAmount: input.principalAmount,
        remainingAmount: input.principalAmount,
        installmentAmount: input.installmentAmount,
        totalMonths: resolvedInstallments.length,
        remainingMonths: resolvedInstallments.length,
        note: input.note,
        status: "healthy",
      });

      draft.debtInstallments.unshift(
        ...resolvedInstallments.map((installment) => ({
          id: createId("inst"),
          debtId,
          installmentNumber: installment.installmentNumber,
          dueOn: installment.dueOn,
          amount: installment.amount,
          lateFeeAmount: installment.lateFeeAmount,
          status: "healthy" as const,
          statusSource: "auto" as const,
          note: installment.note,
        })),
      );
      syncDebtSummary(draft);
    });

    await syncMutation("/api/debts", "POST", input);
  }

  async function payDebt(input: PayDebtInput) {
    applyOptimisticMutation((draft) => {
      removeInstallmentPaymentArtifacts(draft, input.installmentId);
      createInstallmentPayment(draft, input);
      syncDebtSummary(draft);
    });

    await syncMutation("/api/debts/payments", "POST", input);
  }

  async function setDebtInstallmentStatus(input: UpdateDebtInstallmentStatusInput) {
    applyOptimisticMutation((draft) => {
      const installment = draft.debtInstallments.find(
        (item) => item.id === input.installmentId && item.debtId === input.debtId,
      );

      if (!installment) {
        return;
      }

      removeInstallmentPaymentArtifacts(draft, input.installmentId);

      if (input.status === "paid") {
        createInstallmentPayment(draft, {
          debtId: input.debtId,
          installmentId: input.installmentId,
          paidOn: input.paidOn ?? isoToday(),
          note: input.note,
        });
      } else {
        installment.status = input.status;
        installment.statusSource = "manual";
        installment.paidOn = undefined;
        installment.note = input.note ?? installment.note;
      }

      syncDebtSummary(draft);
    });

    await syncMutation(`/api/debts/installments/${input.installmentId}/status`, "POST", input);
  }

  async function updateDebtInstallment(input: UpdateDebtInstallmentInput) {
    applyOptimisticMutation((draft) => {
      const installment = draft.debtInstallments.find((item) => item.id === input.installmentId);

      if (!installment) {
        return;
      }

      const wasPaid = getEffectiveInstallmentStatus(installment) === "paid";
      installment.dueOn = input.dueOn;
      installment.amount = input.amount;
      installment.lateFeeAmount = input.lateFeeAmount;
      installment.note = input.note;
      installment.paidOn = input.paidOn || installment.paidOn;

      if (wasPaid) {
        removeInstallmentPaymentArtifacts(draft, installment.id);
        createInstallmentPayment(draft, {
          debtId: installment.debtId,
          installmentId: installment.id,
          paidOn: installment.paidOn ?? isoToday(),
          note: installment.note,
        });
      }

      syncDebtSummary(draft);
    });

    await syncMutation(`/api/debts/installments/${input.installmentId}`, "PATCH", input);
  }

  async function addTask(input: AddTaskInput) {
    const createdTask: Task = {
      id: createId("task"),
      title: input.title,
      priority: input.priority ?? "medium",
      dueOn: input.dueOn,
      projectId: input.projectId,
      todayPinned: input.todayPinned ?? false,
      note: input.note,
      startTime: input.startTime,
      dueTime: input.dueTime,
      reminderAt: input.reminderAt,
      recurring: input.recurring,
      status: "todo",
      completedAt: undefined,
    };

    applyOptimisticMutation((draft) => {
      draft.tasks.unshift(createdTask);
    });

    const serverTask = await syncMutation<Task>("/api/tasks", "POST", {
      ...input,
      clientId: createdTask.id,
    });

    return serverTask ?? createdTask;
  }

  async function addProject(input: AddProjectInput) {
    const createdProject: Project = {
      id: createId("proj"),
      name: input.name,
      focus: input.focus,
      description: input.description,
      status: "active",
    };

    applyOptimisticMutation((draft) => {
      draft.projects.unshift(createdProject);
    });

    const serverProject = await syncMutation<Project>("/api/projects", "POST", {
      ...input,
      clientId: createdProject.id,
    });

    return serverProject ?? createdProject;
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    applyOptimisticMutation((draft) => {
      const task = draft.tasks.find((item) => item.id === taskId);

      if (task) {
        applyTaskStatus(task, status);
      }
    });

    await syncMutation(`/api/tasks/${taskId}/status`, "POST", { status });
  }

  async function updateTask(input: UpdateTaskInput) {
    applyOptimisticMutation((draft) => {
      const task = draft.tasks.find((item) => item.id === input.taskId);

      if (!task) {
        return;
      }

      task.title = input.title;
      task.priority = input.priority;
      task.dueOn = input.dueOn || undefined;
      task.projectId = input.projectId || undefined;
      task.todayPinned = input.todayPinned ?? false;
      task.note = input.note || undefined;
      task.startTime = input.startTime || undefined;
      task.dueTime = input.dueTime || undefined;
      task.reminderAt = input.reminderAt || undefined;
      task.recurring = input.recurring;
      task.completedAt = input.completedAt;
      applyTaskStatus(task, input.status);
    });

    await syncMutation(`/api/tasks/${input.taskId}`, "PATCH", input);
  }

  async function toggleTodayPin(taskId: string) {
    applyOptimisticMutation((draft) => {
      const task = draft.tasks.find((item) => item.id === taskId);

      if (task && task.status !== "done") {
        task.todayPinned = !task.todayPinned;
      }
    });

    await syncMutation(`/api/tasks/${taskId}/pin`, "POST");
  }

  async function addSubtask(input: AddSubtaskInput) {
    const createdSubtask: Subtask = {
      id: createId("subtask"),
      taskId: input.taskId,
      title: input.title,
      note: input.note,
      done: false,
    };

    applyOptimisticMutation((draft) => {
      draft.subtasks.push(createdSubtask);
    });

    const serverSubtask = await syncMutation<Subtask>("/api/subtasks", "POST", {
      ...input,
      clientId: createdSubtask.id,
    });

    return serverSubtask ?? createdSubtask;
  }

  async function updateSubtask(input: UpdateSubtaskInput) {
    applyOptimisticMutation((draft) => {
      const subtask = draft.subtasks.find((item) => item.id === input.subtaskId);

      if (subtask) {
        subtask.title = input.title;
        subtask.note = input.note || undefined;
      }
    });

    await syncMutation(`/api/subtasks/${input.subtaskId}`, "PATCH", input);
  }

  async function toggleSubtask(subtaskId: string) {
    applyOptimisticMutation((draft) => {
      const subtask = draft.subtasks.find((item) => item.id === subtaskId);

      if (subtask) {
        subtask.done = !subtask.done;
      }
    });

    await syncMutation(`/api/subtasks/${subtaskId}/toggle`, "POST");
  }

  async function addNote(input: AddNoteInput) {
    const createdNote: Note = {
      id: createId("note"),
      title: input.title,
      content: input.content,
      links: dedupeNoteLinks(input.links ?? []),
    };

    applyOptimisticMutation((draft) => {
      draft.notes.unshift(createdNote);
    });

    const serverNote = await syncMutation<Note>("/api/notes", "POST", {
      ...input,
      clientId: createdNote.id,
    });

    return serverNote ?? createdNote;
  }

  async function updateNote(input: UpdateNoteInput) {
    applyOptimisticMutation((draft) => {
      const note = draft.notes.find((item) => item.id === input.noteId);

      if (note) {
        note.title = input.title;
        note.content = input.content;
      }
    });

    await syncMutation(`/api/notes/${input.noteId}`, "PATCH", input);
  }

  async function setNoteLinks(input: SetNoteLinksInput) {
    applyOptimisticMutation((draft) => {
      const note = draft.notes.find((item) => item.id === input.noteId);

      if (note) {
        note.links = dedupeNoteLinks(input.links);
      }
    });

    await syncMutation(`/api/notes/${input.noteId}/links`, "PUT", input);
  }

  async function addWish(input: AddWishInput) {
    const createdWishId = createId("wish");

    applyOptimisticMutation((draft) => {
      draft.wishItems.unshift({
        id: createdWishId,
        name: input.name,
        targetPrice: input.targetPrice,
        priority: input.priority,
        status: "wish",
        note: input.note,
      });
    });

    await syncMutation("/api/wishlist", "POST", {
      ...input,
      clientId: createdWishId,
    });
  }

  async function updateWish(input: UpdateWishInput) {
    applyOptimisticMutation((draft) => {
      const wish = draft.wishItems.find((item) => item.id === input.wishId);

      if (wish) {
        wish.name = input.name;
        wish.targetPrice = input.targetPrice;
        wish.priority = input.priority;
        wish.note = input.note;
      }
    });

    await syncMutation(`/api/wishlist/${input.wishId}`, "PATCH", input);
  }

  async function deleteWish(wishId: string) {
    applyOptimisticMutation((draft) => {
      draft.wishItems = draft.wishItems.filter((item) => item.id !== wishId);
    });

    await syncMutation(`/api/wishlist/${wishId}`, "DELETE");
  }

  async function setWishStatus(input: SetWishStatusInput) {
    applyOptimisticMutation((draft) => {
      const wish = draft.wishItems.find((item) => item.id === input.wishId);

      if (wish) {
        wish.status = input.status;
      }
    });

    await syncMutation(`/api/wishlist/${input.wishId}/status`, "POST", input);
  }

  async function moveWishToShopping(wishId: string) {
    applyOptimisticMutation((draft) => {
      const wish = draft.wishItems.find((item) => item.id === wishId);

      if (!wish || wish.status !== "ready") {
        return;
      }

      wish.status = "moved";
      draft.shoppingItems.unshift({
        id: createId("shop"),
        name: wish.name,
        estimatedPrice: wish.targetPrice,
        quantity: 1,
        section: "Lainnya",
        status: "planned",
        store: undefined,
        sourceWishId: wish.id,
        note: "Dipromosikan dari wishlist",
      });
    });

    await syncMutation(`/api/wishlist/${wishId}/move-to-shopping`, "POST");
  }

  async function addShoppingItem(input: AddShoppingItemInput) {
    const createdItemId = createId("shop");

    applyOptimisticMutation((draft) => {
      draft.shoppingItems.unshift({
        id: createdItemId,
        name: input.name,
        estimatedPrice: input.estimatedPrice,
        quantity: input.quantity,
        section: input.section,
        status: "planned",
        store: input.store,
        note: input.note,
      });
    });

    await syncMutation("/api/shopping", "POST", {
      ...input,
      clientId: createdItemId,
    });
  }

  async function updateShoppingItem(input: UpdateShoppingItemInput) {
    applyOptimisticMutation((draft) => {
      const item = draft.shoppingItems.find((row) => row.id === input.itemId);

      if (item) {
        item.name = input.name;
        item.estimatedPrice = input.estimatedPrice;
        item.quantity = input.quantity;
        item.section = input.section;
        item.store = input.store;
        item.note = input.note;
      }
    });

    await syncMutation(`/api/shopping/${input.itemId}`, "PATCH", input);
  }

  async function deleteShoppingItem(itemId: string) {
    applyOptimisticMutation((draft) => {
      draft.shoppingItems = draft.shoppingItems.filter((item) => item.id !== itemId);
    });

    await syncMutation(`/api/shopping/${itemId}`, "DELETE");
  }

  async function setShoppingStatus(input: SetShoppingStatusInput) {
    applyOptimisticMutation((draft) => {
      const item = draft.shoppingItems.find((row) => row.id === input.itemId);

      if (item) {
        item.status = input.status;
      }
    });

    await syncMutation(`/api/shopping/${input.itemId}/status`, "POST", input);
  }

  async function recordShoppingPurchase(itemId: string) {
    applyOptimisticMutation((draft) => {
      const item = draft.shoppingItems.find((row) => row.id === itemId);
      const defaultAccountId = draft.accounts[0]?.id;
      const defaultCategoryId = getDefaultExpenseCategoryId(draft);
      const activeCycleId = draft.budgetCycles.find((cycle) => cycle.status === "active")?.id;
      const alreadyRecorded = draft.transactions.some(
        (transaction) =>
          transaction.sourceType === "shopping" && transaction.sourceId === itemId,
      );

      if (!item || item.status !== "bought" || !defaultAccountId || alreadyRecorded) {
        return;
      }

      const transactionInput: AddTransactionInput = {
        title: item.name,
        kind: "expense",
        amount: item.estimatedPrice * item.quantity,
        occurredOn: isoToday(),
        accountId: defaultAccountId,
        categoryId: defaultCategoryId,
        cycleId: activeCycleId,
        sourceType: "shopping",
        sourceId: item.id,
        tags: item.sourceWishId ? ["shopping", "wishlist"] : ["shopping"],
        note: item.note ? `${item.note} • Dicatat dari shopping list` : "Dicatat dari shopping list",
      };

      draft.transactions.unshift({
        id: createId("trx"),
        ...transactionInput,
      });
      updateAccountBalances(draft, transactionInput);
      updateCycleSpend(draft, transactionInput);
    });

    await syncMutation(`/api/shopping/${itemId}/record-purchase`, "POST");
  }

  async function reset() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CACHE_KEY);
      window.localStorage.removeItem(OUTBOX_KEY);
    }

    saveOutbox([]);
    await fetchSnapshot();
  }

  return (
    <AppStateContext.Provider
      value={{
        snapshot,
        isHydrated,
        addTransaction,
        addRecurringPlan,
        addDebt,
        payDebt,
        setDebtInstallmentStatus,
        updateDebtInstallment,
        addProject,
        addTask,
        updateTask,
        moveTask,
        toggleTodayPin,
        addSubtask,
        updateSubtask,
        toggleSubtask,
        addNote,
        updateNote,
        setNoteLinks,
        addWish,
        updateWish,
        deleteWish,
        setWishStatus,
        moveWishToShopping,
        addShoppingItem,
        updateShoppingItem,
        deleteShoppingItem,
        setShoppingStatus,
        recordShoppingPurchase,
        reset,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }

  return context;
}

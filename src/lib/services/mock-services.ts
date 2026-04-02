import { initialAppSnapshot } from "@/lib/data/mock-data";
import type {
  AddNoteInput,
  AddProjectInput,
  AddRecurringPlanInput,
  AddSubtaskInput,
  AddTaskInput,
  AppSnapshot,
  Note,
  NoteLink,
  PayDebtInput,
  SetNoteLinksInput,
  Subtask,
  Task,
  UpdateNoteInput,
  UpdateSubtaskInput,
  UpdateTaskInput,
} from "@/lib/domain/models";
import type {
  AuthService,
  FinanceRepository,
  ReminderService,
  TaskRepository,
} from "@/lib/services/contracts";
import {
  getCashflowPoints,
  getFinanceOverview,
  getMonthlyCategorySpendPoints,
  getUpcomingFinanceItems,
} from "@/lib/finance";
import { buildTelegramDigest } from "@/lib/reminders/telegram";
import { createId } from "@/lib/utils";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function dedupeNoteLinks(links: NoteLink[]) {
  return links.filter(
    (link, index) =>
      links.findIndex((item) => item.type === link.type && item.id === link.id) === index,
  );
}

export const mockAuthService: AuthService = {
  async getSession() {
    return deepClone(initialAppSnapshot.session);
  },
  async signIn(email) {
    return {
      ...deepClone(initialAppSnapshot.session),
      email,
    };
  },
  async signOut() {},
};

export const mockFinanceRepository: FinanceRepository = {
  async getBootSnapshot() {
    return deepClone(initialAppSnapshot);
  },
  async listAccounts() {
    return deepClone(initialAppSnapshot.accounts);
  },
  async listCategories() {
    return deepClone(initialAppSnapshot.categories);
  },
  async listBudgetCycles() {
    return deepClone(initialAppSnapshot.budgetCycles);
  },
  async listBudgetCategoryAllocations() {
    return deepClone(initialAppSnapshot.budgetCategoryAllocations);
  },
  async listTransactions() {
    return deepClone(initialAppSnapshot.transactions);
  },
  async addTransaction(input) {
    return {
      id: createId("trx"),
      ...input,
    };
  },
  async listRecurringPlans() {
    return deepClone(initialAppSnapshot.recurringPlans);
  },
  async addRecurringPlan(input: AddRecurringPlanInput) {
    return {
      id: createId("rec"),
      ...input,
      enabled: true,
    };
  },
  async getFinanceOverview(month = "2026-03") {
    return getFinanceOverview(initialAppSnapshot, month);
  },
  async listUpcomingFinanceItems() {
    return getUpcomingFinanceItems(initialAppSnapshot);
  },
  async getCashflowPoints(month = "2026-03") {
    return getCashflowPoints(initialAppSnapshot, month);
  },
  async getCategorySpendPoints(month = "2026-03", cycleId?: string) {
    return cycleId
      ? getMonthlyCategorySpendPoints(initialAppSnapshot, month).map((point) => {
          const budgetPoint = initialAppSnapshot.budgetCategoryAllocations.find(
            (allocation) =>
              allocation.cycleId === cycleId && allocation.categoryId === point.categoryId,
          );

          return {
            ...point,
            allocatedAmount: budgetPoint?.allocatedAmount,
          };
        })
      : getMonthlyCategorySpendPoints(initialAppSnapshot, month);
  },
  async listDebts() {
    return deepClone(initialAppSnapshot.debts);
  },
  async listDebtPayments() {
    return deepClone(initialAppSnapshot.debtPayments);
  },
  async payDebt(input: PayDebtInput) {
    return {
      id: createId("pay"),
      debtId: input.debtId,
      installmentId: input.installmentId,
      amount: input.amount,
      paidOn: input.paidOn,
      remainingAmount: 0,
      note: input.note,
    };
  },
  async addDebt() {},
  async setDebtInstallmentStatus() {},
  async updateDebtInstallment() {},
};

export const mockTaskRepository: TaskRepository = {
  async getBootSnapshot() {
    return deepClone(initialAppSnapshot);
  },
  async listTasks() {
    return deepClone(initialAppSnapshot.tasks);
  },
  async addTask(input: AddTaskInput) {
    return {
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
    };
  },
  async updateTask(input: UpdateTaskInput) {
    const task = initialAppSnapshot.tasks.find((item) => item.id === input.taskId);

    if (!task) {
      throw new Error(`Task ${input.taskId} not found`);
    }

    return {
      ...deepClone(task),
      ...input,
      projectId: input.projectId || undefined,
      note: input.note || undefined,
      startTime: input.startTime || undefined,
      dueTime: input.dueTime || undefined,
      reminderAt: input.reminderAt || undefined,
    };
  },
  async moveTask(taskId: string, status: Task["status"]) {
    const task = initialAppSnapshot.tasks.find((item) => item.id === taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    return {
      ...deepClone(task),
      status,
    };
  },
  async toggleTodayPin(taskId: string) {
    const task = initialAppSnapshot.tasks.find((item) => item.id === taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    return {
      ...deepClone(task),
      todayPinned: !task.todayPinned,
    };
  },
  async listSubtasks() {
    return deepClone(initialAppSnapshot.subtasks);
  },
  async addSubtask(input: AddSubtaskInput) {
    return {
      id: createId("subtask"),
      taskId: input.taskId,
      title: input.title,
      note: input.note,
      done: false,
    } satisfies Subtask;
  },
  async updateSubtask(input: UpdateSubtaskInput) {
    const subtask = initialAppSnapshot.subtasks.find((item) => item.id === input.subtaskId);

    if (!subtask) {
      throw new Error(`Subtask ${input.subtaskId} not found`);
    }

    return {
      ...deepClone(subtask),
      title: input.title,
      note: input.note,
    };
  },
  async toggleSubtask(subtaskId: string) {
    const subtask = initialAppSnapshot.subtasks.find((item) => item.id === subtaskId);

    if (!subtask) {
      throw new Error(`Subtask ${subtaskId} not found`);
    }

    return {
      ...deepClone(subtask),
      done: !subtask.done,
    };
  },
  async listProjects() {
    return deepClone(initialAppSnapshot.projects);
  },
  async addProject(input: AddProjectInput) {
    return {
      id: createId("proj"),
      name: input.name,
      focus: input.focus,
      description: input.description,
      status: "active",
    };
  },
  async listNotes() {
    return deepClone(initialAppSnapshot.notes);
  },
  async addNote(input: AddNoteInput) {
    return {
      id: createId("note"),
      title: input.title,
      content: input.content,
      links: dedupeNoteLinks(input.links ?? []),
    } satisfies Note;
  },
  async updateNote(input: UpdateNoteInput) {
    const note = initialAppSnapshot.notes.find((item) => item.id === input.noteId);

    if (!note) {
      throw new Error(`Note ${input.noteId} not found`);
    }

    return {
      ...deepClone(note),
      title: input.title,
      content: input.content,
    };
  },
  async setNoteLinks(input: SetNoteLinksInput) {
    const note = initialAppSnapshot.notes.find((item) => item.id === input.noteId);

    if (!note) {
      throw new Error(`Note ${input.noteId} not found`);
    }

    return {
      ...deepClone(note),
      links: dedupeNoteLinks(input.links),
    };
  },
};

export const mockReminderService: ReminderService = {
  async listRules() {
    return deepClone(initialAppSnapshot.reminderRules);
  },
  async previewDailyDigest(snapshot: AppSnapshot) {
    return buildTelegramDigest(snapshot);
  },
};

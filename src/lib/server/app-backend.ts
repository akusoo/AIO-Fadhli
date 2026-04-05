import type { SupabaseClient, User } from "@supabase/supabase-js";
import type {
  AddAccountInput,
  AddBudgetCycleInput,
  AddCategoryInput,
  AddDebtInput,
  AddTransactionInput,
  AppSnapshot,
  NoteLink,
  PayDebtInput,
  SetNoteLinksInput,
  UpdateDebtInstallmentInput,
  UpdateDebtInstallmentStatusInput,
} from "@/lib/domain/models";
import {
  getEffectiveInstallmentStatus,
  getInstallmentPaymentAmount,
  recomputeDebtSummaries,
} from "@/lib/debts";
import { createId, isoToday } from "@/lib/utils";

const DEFAULT_LOCATION = "Jakarta";
const PROFILE_BOOTSTRAP_MAX_ATTEMPTS = 4;
const PROFILE_BOOTSTRAP_RETRY_DELAY_MS = 250;
const SUPABASE_READ_MAX_ATTEMPTS = 3;
const SUPABASE_READ_RETRY_DELAY_MS = 400;

type AccountRow = {
  id: string;
  name: string;
  type: AppSnapshot["accounts"][number]["type"];
  balance: number;
};

type CategoryRow = {
  id: string;
  name: string;
  kind: AppSnapshot["categories"][number]["kind"];
};

type BudgetCycleRow = {
  id: string;
  label: string;
  start_on: string;
  end_on: string;
  target_amount: number;
  spent_amount: number;
  income_amount: number;
  status: AppSnapshot["budgetCycles"][number]["status"];
};

type BudgetCategoryAllocationRow = {
  id: string;
  cycle_id: string;
  category_id: string;
  allocated_amount: number;
};

type TransactionRow = {
  id: string;
  title: string;
  kind: AppSnapshot["transactions"][number]["kind"];
  amount: number;
  occurred_on: string;
  account_id: string;
  category_id: string | null;
  cycle_id: string | null;
  merchant: string | null;
  tags: string[] | null;
  note: string | null;
  transfer_target_account_id: string | null;
  source_type: AppSnapshot["transactions"][number]["sourceType"] | null;
  source_id: string | null;
};

type RecurringPlanRow = {
  id: string;
  label: string;
  kind: AppSnapshot["recurringPlans"][number]["kind"];
  amount: number;
  cadence: AppSnapshot["recurringPlans"][number]["cadence"];
  next_occurrence_on: string;
  account_id: string;
  category_id: string | null;
  merchant: string | null;
  tags: string[] | null;
  note: string | null;
  enabled: boolean;
};

type DebtRow = {
  id: string;
  name: string;
  lender: string;
  principal_amount: number;
  remaining_amount: number;
  installment_amount: number;
  total_months: number;
  remaining_months: number;
  note: string | null;
  status: AppSnapshot["debts"][number]["status"];
};

type DebtInstallmentRow = {
  id: string;
  debt_id: string;
  installment_number: number;
  due_on: string;
  amount: number;
  late_fee_amount: number;
  status: AppSnapshot["debtInstallments"][number]["status"];
  status_source: AppSnapshot["debtInstallments"][number]["statusSource"];
  paid_on: string | null;
  note: string | null;
};

type DebtPaymentRow = {
  id: string;
  debt_id: string;
  installment_id: string;
  amount: number;
  paid_on: string;
  remaining_amount: number;
  note: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  status: AppSnapshot["projects"][number]["status"];
  focus: string;
};

type TaskRow = {
  id: string;
  title: string;
  status: AppSnapshot["tasks"][number]["status"];
  priority: AppSnapshot["tasks"][number]["priority"];
  due_on: string | null;
  project_id: string | null;
  today_pinned: boolean;
  note: string | null;
  start_time: string | null;
  due_time: string | null;
  reminder_at: string | null;
  completed_at: string | null;
  recurring_cadence: "daily" | "weekly" | "monthly" | null;
  recurring_interval: number | null;
};

type SubtaskRow = {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  note: string | null;
};

type NoteRow = {
  id: string;
  title: string;
  content: string;
};

type NoteLinkRow = {
  note_id: string;
  link_type: NoteLink["type"];
  link_id: string;
};

type WishItemRow = {
  id: string;
  name: string;
  target_price: number;
  priority: AppSnapshot["wishItems"][number]["priority"];
  status: AppSnapshot["wishItems"][number]["status"];
  note: string | null;
  source_url: string | null;
  image_url: string | null;
};

type ShoppingItemRow = {
  id: string;
  name: string;
  estimated_price: number;
  quantity: number | null;
  section: string | null;
  status: AppSnapshot["shoppingItems"][number]["status"];
  store: string | null;
  source_wish_id: string | null;
  note: string | null;
};

type ReminderRuleRow = {
  id: string;
  channel: AppSnapshot["reminderRules"][number]["channel"];
  cadence: AppSnapshot["reminderRules"][number]["cadence"];
  enabled: boolean;
  label: string;
};

type AppTableRows = {
  accounts: AccountRow;
  categories: CategoryRow;
  budget_cycles: BudgetCycleRow;
  budget_category_allocations: BudgetCategoryAllocationRow;
  transactions: TransactionRow;
  recurring_plans: RecurringPlanRow;
  debts: DebtRow;
  debt_installments: DebtInstallmentRow;
  debt_payments: DebtPaymentRow;
  projects: ProjectRow;
  tasks: TaskRow;
  subtasks: SubtaskRow;
  notes: NoteRow;
  note_links: NoteLinkRow;
  wish_items: WishItemRow;
  shopping_items: ShoppingItemRow;
  reminder_rules: ReminderRuleRow;
};

type SupabaseErrorLike = {
  message: string;
  code?: string;
} | null;

function raiseIfError(error: SupabaseErrorLike) {
  if (error) {
    throw new Error(error.message);
  }
}

function isProfileBootstrapForeignKeyError(error: SupabaseErrorLike) {
  return Boolean(
    error &&
      (error.code === "23503" ||
        error.message.includes('violates foreign key constraint "profiles_id_fkey"')),
  );
}

function isTransientSupabaseReadError(error: SupabaseErrorLike) {
  return Boolean(
    error &&
      (error.message.includes("fetch failed") ||
        error.message.includes("Connect Timeout Error") ||
        error.message.includes("timeout")),
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSupabaseRead<T>(
  operation: () => Promise<{ data: T | null; error: SupabaseErrorLike }>,
) {
  let lastResult: { data: T | null; error: SupabaseErrorLike } | null = null;

  for (let attempt = 0; attempt < SUPABASE_READ_MAX_ATTEMPTS; attempt += 1) {
    const result = await operation();
    lastResult = result;

    if (
      !result.error ||
      !isTransientSupabaseReadError(result.error) ||
      attempt === SUPABASE_READ_MAX_ATTEMPTS - 1
    ) {
      return result;
    }

    await wait(SUPABASE_READ_RETRY_DELAY_MS * (attempt + 1));
  }

  return lastResult as { data: T | null; error: SupabaseErrorLike };
}

function bootstrapId(userId: string, key: string) {
  return `${key}-${userId}`;
}

function displayNameFromUser(user: User) {
  const candidate =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : user.email?.split("@")[0];

  return candidate?.trim() || "Personal User";
}

function normalizeNoteLinks(links: NoteLink[]) {
  return links.filter(
    (link, index) =>
      links.findIndex((candidate) => candidate.type === link.type && candidate.id === link.id) ===
      index,
  );
}

async function listRows<TTable extends keyof AppTableRows>(
  supabase: SupabaseClient,
  table: TTable,
  userId: string,
  orderBy?: string,
  ascending = true,
) {
  const { data, error } = await runSupabaseRead(async () => {
    let query = supabase.from(table).select("*").eq("user_id", userId).is("deleted_at", null);

    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }

    return await query;
  });

  raiseIfError(error);
  return (data ?? []) as AppTableRows[TTable][];
}

async function listStarterPresence(supabase: SupabaseClient, table: string, userId: string) {
  const { data, error } = await runSupabaseRead<{ id: string }[]>(async () =>
    await supabase.from(table).select("id").eq("user_id", userId).is("deleted_at", null).limit(1),
  );

  raiseIfError(error);
  return (data ?? []).length > 0;
}

async function ensureProfileRow(supabase: SupabaseClient, user: User) {
  for (let attempt = 0; attempt < PROFILE_BOOTSTRAP_MAX_ATTEMPTS; attempt += 1) {
    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        name: displayNameFromUser(user),
        email: user.email ?? "",
        location: DEFAULT_LOCATION,
      },
      { onConflict: "id" },
    );

    if (!error) {
      return;
    }

    if (
      !isProfileBootstrapForeignKeyError(error) ||
      attempt === PROFILE_BOOTSTRAP_MAX_ATTEMPTS - 1
    ) {
      raiseIfError(error);
    }

    await wait(PROFILE_BOOTSTRAP_RETRY_DELAY_MS * (attempt + 1));
  }
}

export async function ensureUserBootstrap(supabase: SupabaseClient, user: User) {
  const { data: existingProfile, error: profileError } = await runSupabaseRead(async () =>
    await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  );

  raiseIfError(profileError);

  if (!existingProfile) {
    await ensureProfileRow(supabase, user);
  }

  if (!(await listStarterPresence(supabase, "categories", user.id))) {
    const { error } = await supabase.from("categories").upsert(
      [
        {
          id: bootstrapId(user.id, "cat-salary"),
          user_id: user.id,
          name: "Pemasukan",
          kind: "income",
        },
        {
          id: bootstrapId(user.id, "cat-food"),
          user_id: user.id,
          name: "Makan & Jajan",
          kind: "expense",
        },
        {
          id: bootstrapId(user.id, "cat-transport"),
          user_id: user.id,
          name: "Transport",
          kind: "expense",
        },
        {
          id: bootstrapId(user.id, "cat-tools"),
          user_id: user.id,
          name: "Tools",
          kind: "expense",
        },
        {
          id: bootstrapId(user.id, "cat-bills"),
          user_id: user.id,
          name: "Tagihan",
          kind: "expense",
        },
        {
          id: bootstrapId(user.id, "cat-installment"),
          user_id: user.id,
          name: "Cicilan",
          kind: "expense",
        },
      ],
      { onConflict: "id" },
    );

    raiseIfError(error);
  }

  if (!(await listStarterPresence(supabase, "accounts", user.id))) {
    const { error } = await supabase.from("accounts").upsert(
      {
        id: bootstrapId(user.id, "acct-main"),
        user_id: user.id,
        name: "Akun utama",
        type: "bank",
        balance: 0,
      },
      { onConflict: "id" },
    );

    raiseIfError(error);
  }

  if (!(await listStarterPresence(supabase, "reminder_rules", user.id))) {
    const { error } = await supabase.from("reminder_rules").upsert(
      [
        {
          id: bootstrapId(user.id, "rem-event"),
          user_id: user.id,
          channel: "telegram",
          cadence: "event-based",
          enabled: true,
          label: "Jatuh tempo dan deadline penting",
        },
        {
          id: bootstrapId(user.id, "rem-digest"),
          user_id: user.id,
          channel: "telegram",
          cadence: "daily-digest",
          enabled: true,
          label: "Ringkasan pagi jam 08:00",
        },
      ],
      { onConflict: "id" },
    );

    raiseIfError(error);
  }
}

export async function createAccount(
  supabase: SupabaseClient,
  userId: string,
  input: AddAccountInput,
  accountId = createId("acct"),
) {
  const { error } = await supabase.from("accounts").insert({
    id: accountId,
    user_id: userId,
    name: input.name,
    type: input.type,
    balance: input.balance,
  });

  raiseIfError(error);
  return accountId;
}

export async function createCategory(
  supabase: SupabaseClient,
  userId: string,
  input: AddCategoryInput,
  categoryId = createId("cat"),
) {
  const { error } = await supabase.from("categories").insert({
    id: categoryId,
    user_id: userId,
    name: input.name,
    kind: input.kind,
  });

  raiseIfError(error);
  return categoryId;
}

export async function createBudgetCycle(
  supabase: SupabaseClient,
  userId: string,
  input: AddBudgetCycleInput,
  cycleId = createId("cycle"),
) {
  if (input.status === "active") {
    const { error: resetError } = await supabase
      .from("budget_cycles")
      .update({ status: "completed" })
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null);

    raiseIfError(resetError);
  }

  const { error } = await supabase.from("budget_cycles").insert({
    id: cycleId,
    user_id: userId,
    label: input.label,
    start_on: input.startOn,
    end_on: input.endOn,
    target_amount: input.targetAmount,
    spent_amount: 0,
    income_amount: 0,
    status: input.status,
  });

  raiseIfError(error);
  return cycleId;
}

export async function buildAppSnapshot(supabase: SupabaseClient, user: User): Promise<AppSnapshot> {
  await ensureUserBootstrap(supabase, user);

  const [
    profileRows,
    accounts,
    categories,
    budgetCycles,
    budgetCategoryAllocations,
    transactions,
    recurringPlans,
    debts,
    debtInstallments,
    debtPayments,
    projects,
    tasks,
    subtasks,
    notes,
    noteLinks,
    wishItems,
    shoppingItems,
    reminderRules,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    listRows(supabase, "accounts", user.id, "created_at", true),
    listRows(supabase, "categories", user.id, "created_at", true),
    listRows(supabase, "budget_cycles", user.id, "start_on", false),
    listRows(supabase, "budget_category_allocations", user.id, "created_at", true),
    listRows(supabase, "transactions", user.id, "occurred_on", false),
    listRows(supabase, "recurring_plans", user.id, "next_occurrence_on", true),
    listRows(supabase, "debts", user.id, "created_at", false),
    listRows(supabase, "debt_installments", user.id, "due_on", true),
    listRows(supabase, "debt_payments", user.id, "paid_on", false),
    listRows(supabase, "projects", user.id, "created_at", false),
    listRows(supabase, "tasks", user.id, "created_at", false),
    listRows(supabase, "subtasks", user.id, "created_at", true),
    listRows(supabase, "notes", user.id, "created_at", false),
    listRows(supabase, "note_links", user.id, "created_at", true),
    listRows(supabase, "wish_items", user.id, "created_at", false),
    listRows(supabase, "shopping_items", user.id, "created_at", false),
    listRows(supabase, "reminder_rules", user.id, "created_at", true),
  ]);

  raiseIfError(profileRows.error);
  const profile = profileRows.data;

  const snapshot: AppSnapshot = {
    session: {
      id: user.id,
      name:
        typeof profile?.name === "string" && profile.name
          ? profile.name
          : displayNameFromUser(user),
      email: user.email ?? profile?.email ?? "",
      location:
        typeof profile?.location === "string" && profile.location
          ? profile.location
          : DEFAULT_LOCATION,
    },
    accounts: accounts.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      balance: item.balance,
    })),
    categories: categories.map((item) => ({
      id: item.id,
      name: item.name,
      kind: item.kind,
    })),
    budgetCycles: budgetCycles.map((item) => ({
      id: item.id,
      label: item.label,
      startOn: item.start_on,
      endOn: item.end_on,
      targetAmount: item.target_amount,
      spentAmount: item.spent_amount,
      incomeAmount: item.income_amount,
      status: item.status,
    })),
    budgetCategoryAllocations: budgetCategoryAllocations.map((item) => ({
      id: item.id,
      cycleId: item.cycle_id,
      categoryId: item.category_id,
      allocatedAmount: item.allocated_amount,
    })),
    transactions: transactions.map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
      amount: item.amount,
      occurredOn: item.occurred_on,
      accountId: item.account_id,
      categoryId: item.category_id ?? undefined,
      cycleId: item.cycle_id ?? undefined,
      merchant: item.merchant ?? undefined,
      tags: item.tags ?? [],
      note: item.note ?? undefined,
      transferTargetAccountId: item.transfer_target_account_id ?? undefined,
      sourceType: item.source_type ?? undefined,
      sourceId: item.source_id ?? undefined,
    })),
    recurringPlans: recurringPlans.map((item) => ({
      id: item.id,
      label: item.label,
      kind: item.kind,
      amount: item.amount,
      cadence: item.cadence,
      nextOccurrenceOn: item.next_occurrence_on,
      accountId: item.account_id,
      categoryId: item.category_id ?? undefined,
      merchant: item.merchant ?? undefined,
      tags: item.tags ?? [],
      note: item.note ?? undefined,
      enabled: item.enabled,
    })),
    debts: debts.map((item) => ({
      id: item.id,
      name: item.name,
      lender: item.lender,
      principalAmount: item.principal_amount,
      remainingAmount: item.remaining_amount,
      installmentAmount: item.installment_amount,
      totalMonths: item.total_months,
      remainingMonths: item.remaining_months,
      note: item.note ?? undefined,
      status: item.status,
    })),
    debtInstallments: debtInstallments.map((item) => ({
      id: item.id,
      debtId: item.debt_id,
      installmentNumber: item.installment_number,
      dueOn: item.due_on,
      amount: item.amount,
      lateFeeAmount: item.late_fee_amount,
      status: item.status,
      statusSource: item.status_source,
      paidOn: item.paid_on ?? undefined,
      note: item.note ?? undefined,
    })),
    debtPayments: debtPayments.map((item) => ({
      id: item.id,
      debtId: item.debt_id,
      installmentId: item.installment_id,
      amount: item.amount,
      paidOn: item.paid_on,
      remainingAmount: item.remaining_amount,
      note: item.note ?? undefined,
    })),
    projects: projects.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      status: item.status,
      focus: item.focus,
    })),
    tasks: tasks.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      priority: item.priority,
      dueOn: item.due_on ?? undefined,
      projectId: item.project_id ?? undefined,
      todayPinned: Boolean(item.today_pinned),
      note: item.note ?? undefined,
      startTime: item.start_time ?? undefined,
      dueTime: item.due_time ?? undefined,
      reminderAt: item.reminder_at ?? undefined,
      completedAt: item.completed_at ?? undefined,
      recurring: item.recurring_cadence
        ? {
            cadence: item.recurring_cadence,
            interval: item.recurring_interval ?? undefined,
          }
        : undefined,
    })),
    subtasks: subtasks.map((item) => ({
      id: item.id,
      taskId: item.task_id,
      title: item.title,
      done: item.done,
      note: item.note ?? undefined,
    })),
    notes: notes.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      links: normalizeNoteLinks(
        noteLinks
          .filter((link) => link.note_id === item.id)
          .map((link) => ({
            type: link.link_type,
            id: link.link_id,
          })),
      ),
    })),
    wishItems: wishItems.map((item) => ({
      id: item.id,
      name: item.name,
      targetPrice: item.target_price,
      priority: item.priority,
      status: item.status,
      note: item.note ?? undefined,
      sourceUrl: item.source_url ?? undefined,
      imageUrl: item.image_url ?? undefined,
    })),
    shoppingItems: shoppingItems.map((item) => ({
      id: item.id,
      name: item.name,
      estimatedPrice: item.estimated_price,
      quantity: item.quantity ?? 1,
      section: item.section ?? "Lainnya",
      status: item.status,
      store: item.store ?? undefined,
      sourceWishId: item.source_wish_id ?? undefined,
      note: item.note ?? undefined,
    })),
    reminderRules: reminderRules.map((item) => ({
      id: item.id,
      channel: item.channel,
      cadence: item.cadence,
      enabled: item.enabled,
      label: item.label,
    })),
  };

  recomputeDebtSummaries(snapshot.debts, snapshot.debtInstallments, snapshot.debtPayments);
  return snapshot;
}

async function getDefaultExpenseCategoryId(supabase: SupabaseClient, userId: string) {
  const categories = await listRows(supabase, "categories", userId, "created_at", true);

  return (
    categories.find((item) => item.name === "Cicilan")?.id ??
    categories.find((item) => item.kind === "expense")?.id
  );
}

async function getDefaultPaymentAccountId(supabase: SupabaseClient, userId: string) {
  const accounts = await listRows(supabase, "accounts", userId, "created_at", true);

  return accounts.find((item) => item.type === "bank")?.id ?? accounts[0]?.id;
}

async function getActiveCycleId(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("budget_cycles")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  raiseIfError(error);
  return data?.id as string | undefined;
}

async function adjustAccountBalances(supabase: SupabaseClient, input: AddTransactionInput) {
  const { data: account, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", input.accountId)
    .is("deleted_at", null)
    .maybeSingle();

  raiseIfError(error);

  if (!account) {
    return;
  }

  let nextBalance = account.balance;

  if (input.kind === "income") {
    nextBalance += input.amount;
  }

  if (input.kind === "expense") {
    nextBalance -= input.amount;
  }

  if (input.kind === "transfer") {
    nextBalance -= input.amount;
  }

  const { error: updateError } = await supabase
    .from("accounts")
    .update({ balance: nextBalance })
    .eq("id", input.accountId);

  raiseIfError(updateError);

  if (input.kind === "transfer" && input.transferTargetAccountId) {
    const { data: target, error: targetError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", input.transferTargetAccountId)
      .is("deleted_at", null)
      .maybeSingle();

    raiseIfError(targetError);

    if (target) {
      const { error: targetUpdateError } = await supabase
        .from("accounts")
        .update({ balance: target.balance + input.amount })
        .eq("id", target.id);

      raiseIfError(targetUpdateError);
    }
  }
}

async function revertAccountBalances(supabase: SupabaseClient, input: AddTransactionInput) {
  const reversed: AddTransactionInput = {
    ...input,
    kind:
      input.kind === "income"
        ? "expense"
        : input.kind === "expense"
          ? "income"
          : "transfer",
  };

  if (input.kind === "transfer") {
    const { data: account, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", input.accountId)
      .is("deleted_at", null)
      .maybeSingle();

    raiseIfError(error);

    if (account) {
      const { error: accountError } = await supabase
        .from("accounts")
        .update({ balance: account.balance + input.amount })
        .eq("id", account.id);

      raiseIfError(accountError);
    }

    if (input.transferTargetAccountId) {
      const { data: target, error: targetError } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", input.transferTargetAccountId)
        .is("deleted_at", null)
        .maybeSingle();

      raiseIfError(targetError);

      if (target) {
        const { error: targetUpdateError } = await supabase
          .from("accounts")
          .update({ balance: target.balance - input.amount })
          .eq("id", target.id);

        raiseIfError(targetUpdateError);
      }
    }

    return;
  }

  await adjustAccountBalances(supabase, reversed);
}

async function adjustCycleAmounts(supabase: SupabaseClient, input: AddTransactionInput) {
  if (!input.cycleId) {
    return;
  }

  const { data: cycle, error } = await supabase
    .from("budget_cycles")
    .select("*")
    .eq("id", input.cycleId)
    .is("deleted_at", null)
    .maybeSingle();

  raiseIfError(error);

  if (!cycle) {
    return;
  }

  const nextValues = {
    spent_amount: cycle.spent_amount,
    income_amount: cycle.income_amount,
  };

  if (input.kind === "expense") {
    nextValues.spent_amount += input.amount;
  }

  if (input.kind === "income") {
    nextValues.income_amount += input.amount;
  }

  const { error: updateError } = await supabase
    .from("budget_cycles")
    .update(nextValues)
    .eq("id", cycle.id);

  raiseIfError(updateError);
}

async function revertCycleAmounts(supabase: SupabaseClient, input: AddTransactionInput) {
  if (!input.cycleId) {
    return;
  }

  const reversed: AddTransactionInput = {
    ...input,
    kind:
      input.kind === "income"
        ? "expense"
        : input.kind === "expense"
          ? "income"
          : "transfer",
  };

  await adjustCycleAmounts(supabase, reversed);
}

export async function createTransactionWithSideEffects(
  supabase: SupabaseClient,
  userId: string,
  input: AddTransactionInput,
  transactionId = createId("trx"),
) {
  const { error } = await supabase.from("transactions").insert({
    id: transactionId,
    user_id: userId,
    title: input.title,
    kind: input.kind,
    amount: input.amount,
    occurred_on: input.occurredOn,
    account_id: input.accountId,
    category_id: input.categoryId ?? null,
    cycle_id: input.cycleId ?? null,
    merchant: input.merchant ?? null,
    tags: input.tags ?? [],
    note: input.note ?? null,
    transfer_target_account_id: input.transferTargetAccountId ?? null,
    source_type: input.sourceType ?? null,
    source_id: input.sourceId ?? null,
  });

  raiseIfError(error);
  await adjustAccountBalances(supabase, input);
  await adjustCycleAmounts(supabase, input);
  return transactionId;
}

async function softDeleteTransactionsBySource(
  supabase: SupabaseClient,
  userId: string,
  sourceType: "shopping" | "debt_installment",
  sourceId: string,
) {
  const transactions = await listRows(supabase, "transactions", userId, "created_at", false);
  const linked = transactions.filter(
    (item) => item.source_type === sourceType && item.source_id === sourceId,
  );

  for (const transaction of linked) {
    await revertAccountBalances(supabase, {
      title: transaction.title,
      kind: transaction.kind,
      amount: transaction.amount,
      occurredOn: transaction.occurred_on,
      accountId: transaction.account_id,
      categoryId: transaction.category_id ?? undefined,
      cycleId: transaction.cycle_id ?? undefined,
      merchant: transaction.merchant ?? undefined,
      tags: transaction.tags ?? [],
      note: transaction.note ?? undefined,
      transferTargetAccountId: transaction.transfer_target_account_id ?? undefined,
      sourceType: transaction.source_type ?? undefined,
      sourceId: transaction.source_id ?? undefined,
    });
    await revertCycleAmounts(supabase, {
      title: transaction.title,
      kind: transaction.kind,
      amount: transaction.amount,
      occurredOn: transaction.occurred_on,
      accountId: transaction.account_id,
      categoryId: transaction.category_id ?? undefined,
      cycleId: transaction.cycle_id ?? undefined,
      merchant: transaction.merchant ?? undefined,
      tags: transaction.tags ?? [],
      note: transaction.note ?? undefined,
      transferTargetAccountId: transaction.transfer_target_account_id ?? undefined,
      sourceType: transaction.source_type ?? undefined,
      sourceId: transaction.source_id ?? undefined,
    });

    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", transaction.id);

    raiseIfError(error);
  }
}

async function persistDebtSummary(supabase: SupabaseClient, userId: string) {
  const debts = (await listRows(supabase, "debts", userId, "created_at", false)).map(
    (item) => ({
      id: item.id,
      name: item.name,
      lender: item.lender,
      principalAmount: item.principal_amount,
      remainingAmount: item.remaining_amount,
      installmentAmount: item.installment_amount,
      totalMonths: item.total_months,
      remainingMonths: item.remaining_months,
      note: item.note ?? undefined,
      status: item.status,
    }),
  );
  const installments = (
    await listRows(supabase, "debt_installments", userId, "due_on", true)
  ).map((item) => ({
    id: item.id,
    debtId: item.debt_id,
    installmentNumber: item.installment_number,
    dueOn: item.due_on,
    amount: item.amount,
    lateFeeAmount: item.late_fee_amount,
    status: item.status,
    statusSource: item.status_source,
    paidOn: item.paid_on ?? undefined,
    note: item.note ?? undefined,
  }));
  const payments = (await listRows(supabase, "debt_payments", userId, "paid_on", false)).map(
    (item) => ({
      id: item.id,
      debtId: item.debt_id,
      installmentId: item.installment_id,
      amount: item.amount,
      paidOn: item.paid_on,
      remainingAmount: item.remaining_amount,
      note: item.note ?? undefined,
    }),
  );

  recomputeDebtSummaries(debts, installments, payments);

  for (const debt of debts) {
    const { error } = await supabase
      .from("debts")
      .update({
        remaining_amount: debt.remainingAmount,
        remaining_months: debt.remainingMonths,
        total_months: debt.totalMonths,
        status: debt.status,
      })
      .eq("id", debt.id);

    raiseIfError(error);
  }

  for (const installment of installments) {
    const { error } = await supabase
      .from("debt_installments")
      .update({
        status: installment.status,
        status_source: installment.statusSource,
        paid_on: installment.paidOn ?? null,
        note: installment.note ?? null,
      })
      .eq("id", installment.id);

    raiseIfError(error);
  }

  return { debts, installments, payments };
}

async function removeInstallmentPaymentArtifacts(
  supabase: SupabaseClient,
  userId: string,
  installmentId: string,
) {
  await softDeleteTransactionsBySource(supabase, userId, "debt_installment", installmentId);

  const { error } = await supabase
    .from("debt_payments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("installment_id", installmentId)
    .is("deleted_at", null);

  raiseIfError(error);
}

async function createInstallmentPaymentArtifacts(
  supabase: SupabaseClient,
  userId: string,
  input: { debtId: string; installmentId: string; paidOn: string; note?: string },
) {
  const { data: installmentRow, error: installmentError } = await supabase
    .from("debt_installments")
    .select("*")
    .eq("id", input.installmentId)
    .eq("user_id", userId)
    .maybeSingle();
  raiseIfError(installmentError);

  const { data: debtRow, error: debtError } = await supabase
    .from("debts")
    .select("*")
    .eq("id", input.debtId)
    .eq("user_id", userId)
    .maybeSingle();
  raiseIfError(debtError);

  if (!installmentRow || !debtRow) {
    throw new Error("Installment atau debt tidak ditemukan.");
  }

  const { error: updateInstallmentError } = await supabase
    .from("debt_installments")
    .update({
      status: "paid",
      status_source: "manual",
      paid_on: input.paidOn,
      note: input.note ?? installmentRow.note ?? null,
    })
    .eq("id", installmentRow.id);
  raiseIfError(updateInstallmentError);

  const summary = await persistDebtSummary(supabase, userId);
  const syncedInstallment = summary.installments.find((item) => item.id === installmentRow.id);
  const syncedDebt = summary.debts.find((item) => item.id === debtRow.id);

  const paymentAmount = getInstallmentPaymentAmount({
    id: installmentRow.id,
    debtId: installmentRow.debt_id,
    installmentNumber: installmentRow.installment_number,
    dueOn: installmentRow.due_on,
    amount: installmentRow.amount,
    lateFeeAmount: installmentRow.late_fee_amount,
    status: installmentRow.status,
    statusSource: installmentRow.status_source,
    paidOn: installmentRow.paid_on ?? undefined,
    note: installmentRow.note ?? undefined,
  });

  const { error: paymentError } = await supabase.from("debt_payments").insert({
    id: createId("pay"),
    user_id: userId,
    debt_id: input.debtId,
    installment_id: input.installmentId,
    amount: paymentAmount,
    paid_on: input.paidOn,
    remaining_amount: syncedDebt?.remainingAmount ?? 0,
    note: input.note ?? null,
  });
  raiseIfError(paymentError);

  const accountId = await getDefaultPaymentAccountId(supabase, userId);
  const categoryId = await getDefaultExpenseCategoryId(supabase, userId);

  if (accountId && categoryId) {
    await createTransactionWithSideEffects(supabase, userId, {
      title: `${debtRow.name} • cicilan ${installmentRow.installment_number}`,
      kind: "expense",
      amount: paymentAmount,
      occurredOn: input.paidOn,
      accountId,
      categoryId,
      cycleId: await getActiveCycleId(supabase, userId),
      tags: ["cicilan", debtRow.name.toLowerCase()],
      note: input.note
        ? `${input.note} • otomatis dari modul hutang`
        : "Otomatis dari modul hutang",
      sourceType: "debt_installment",
      sourceId: installmentRow.id,
    });
  }

  return {
    debt: syncedDebt,
    installment: syncedInstallment,
  };
}

export async function addDebtWithInstallments(
  supabase: SupabaseClient,
  userId: string,
  input: AddDebtInput,
) {
  const debtId = createId("debt");
  const resolvedInstallments =
    input.installments?.length
      ? input.installments
      : Array.from({ length: input.totalMonths }, (_, index) => {
          const date = new Date(input.firstDueOn);
          date.setMonth(date.getMonth() + index);

          return {
            installmentNumber: index + 1,
            dueOn: date.toISOString().slice(0, 10),
            amount: input.installmentAmount,
            lateFeeAmount: input.lateFeeAmount,
            note: input.note,
          };
        });

  const { error: debtError } = await supabase.from("debts").insert({
    id: debtId,
    user_id: userId,
    name: input.name,
    lender: input.lender,
    principal_amount: input.principalAmount,
    remaining_amount: input.principalAmount,
    installment_amount: input.installmentAmount,
    total_months: resolvedInstallments.length,
    remaining_months: resolvedInstallments.length,
    note: input.note ?? null,
    status: "healthy",
  });
  raiseIfError(debtError);

  const { error: installmentsError } = await supabase.from("debt_installments").insert(
    resolvedInstallments.map((installment) => ({
      id: createId("inst"),
      user_id: userId,
      debt_id: debtId,
      installment_number: installment.installmentNumber,
      due_on: installment.dueOn,
      amount: installment.amount,
      late_fee_amount: installment.lateFeeAmount,
      status: "healthy",
      status_source: "auto",
      note: installment.note ?? null,
    })),
  );
  raiseIfError(installmentsError);

  await persistDebtSummary(supabase, userId);
  return debtId;
}

export async function payDebtWithSideEffects(
  supabase: SupabaseClient,
  userId: string,
  input: PayDebtInput,
) {
  await removeInstallmentPaymentArtifacts(supabase, userId, input.installmentId);
  await createInstallmentPaymentArtifacts(supabase, userId, {
    debtId: input.debtId,
    installmentId: input.installmentId,
    paidOn: input.paidOn,
    note: input.note,
  });
}

export async function updateDebtInstallmentStatusWithSideEffects(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateDebtInstallmentStatusInput,
) {
  await removeInstallmentPaymentArtifacts(supabase, userId, input.installmentId);

  if (input.status === "paid") {
    await createInstallmentPaymentArtifacts(supabase, userId, {
      debtId: input.debtId,
      installmentId: input.installmentId,
      paidOn: input.paidOn ?? isoToday(),
      note: input.note,
    });
    return;
  }

  const { error } = await supabase
    .from("debt_installments")
    .update({
      status: input.status,
      status_source: "manual",
      paid_on: null,
      note: input.note ?? null,
    })
    .eq("id", input.installmentId)
    .eq("user_id", userId);

  raiseIfError(error);
  await persistDebtSummary(supabase, userId);
}

export async function updateDebtInstallmentWithSideEffects(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateDebtInstallmentInput,
) {
  const { data: installmentRow, error: installmentError } = await supabase
    .from("debt_installments")
    .select("*")
    .eq("id", input.installmentId)
    .eq("user_id", userId)
    .maybeSingle();

  raiseIfError(installmentError);

  if (!installmentRow) {
    throw new Error("Installment tidak ditemukan.");
  }

  const wasPaid =
    getEffectiveInstallmentStatus({
      id: installmentRow.id,
      debtId: installmentRow.debt_id,
      installmentNumber: installmentRow.installment_number,
      dueOn: installmentRow.due_on,
      amount: installmentRow.amount,
      lateFeeAmount: installmentRow.late_fee_amount,
      status: installmentRow.status,
      statusSource: installmentRow.status_source,
      paidOn: installmentRow.paid_on ?? undefined,
      note: installmentRow.note ?? undefined,
    }) === "paid";

  await removeInstallmentPaymentArtifacts(supabase, userId, input.installmentId);

  const { error } = await supabase
    .from("debt_installments")
    .update({
      due_on: input.dueOn,
      amount: input.amount,
      late_fee_amount: input.lateFeeAmount,
      note: input.note ?? null,
      paid_on: input.paidOn ?? installmentRow.paid_on ?? null,
    })
    .eq("id", input.installmentId)
    .eq("user_id", userId);

  raiseIfError(error);

  if (wasPaid) {
    await createInstallmentPaymentArtifacts(supabase, userId, {
      debtId: installmentRow.debt_id,
      installmentId: input.installmentId,
      paidOn: input.paidOn ?? installmentRow.paid_on ?? isoToday(),
      note: input.note,
    });
    return;
  }

  await persistDebtSummary(supabase, userId);
}

export async function replaceNoteLinks(
  supabase: SupabaseClient,
  userId: string,
  input: SetNoteLinksInput,
) {
  const deduped = normalizeNoteLinks(input.links);
  const deletedAt = new Date().toISOString();

  const { error: softDeleteError } = await supabase
    .from("note_links")
    .update({ deleted_at: deletedAt })
    .eq("user_id", userId)
    .eq("note_id", input.noteId)
    .is("deleted_at", null);
  raiseIfError(softDeleteError);

  if (deduped.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("note_links").insert(
    deduped.map((link) => ({
      id: createId("nlink"),
      user_id: userId,
      note_id: input.noteId,
      link_type: link.type,
      link_id: link.id,
    })),
  );

  raiseIfError(insertError);
}

export async function softDeleteById(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  id: string,
) {
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null);

  raiseIfError(error);
}

export async function moveWishToShoppingWithSideEffects(
  supabase: SupabaseClient,
  userId: string,
  wishId: string,
) {
  const { data: wish, error } = await supabase
    .from("wish_items")
    .select("*")
    .eq("id", wishId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  raiseIfError(error);

  if (!wish || wish.status !== "ready") {
    throw new Error("Wishlist item belum siap dipindah ke shopping.");
  }

  const { error: wishError } = await supabase
    .from("wish_items")
    .update({ status: "moved" })
    .eq("id", wishId);
  raiseIfError(wishError);

  const { error: shoppingError } = await supabase.from("shopping_items").insert({
    id: createId("shop"),
    user_id: userId,
    name: wish.name,
    estimated_price: wish.target_price,
    quantity: 1,
    section: "Lainnya",
    status: "planned",
    source_wish_id: wish.id,
    note: "Dipromosikan dari wishlist",
  });
  raiseIfError(shoppingError);
}

export async function recordShoppingPurchaseWithSideEffects(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
) {
  const { data: item, error } = await supabase
    .from("shopping_items")
    .select("*")
    .eq("id", itemId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  raiseIfError(error);

  if (!item || item.status !== "bought") {
    throw new Error("Item belanja belum berstatus bought.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("source_type", "shopping")
    .eq("source_id", itemId)
    .is("deleted_at", null)
    .limit(1);
  raiseIfError(existingError);

  if ((existing ?? []).length > 0) {
    return;
  }

  const accountId = await getDefaultPaymentAccountId(supabase, userId);
  const categoryId = await getDefaultExpenseCategoryId(supabase, userId);

  if (!accountId || !categoryId) {
    return;
  }

  await createTransactionWithSideEffects(supabase, userId, {
    title: item.name,
    kind: "expense",
    amount: item.estimated_price * item.quantity,
    occurredOn: isoToday(),
    accountId,
    categoryId,
    cycleId: await getActiveCycleId(supabase, userId),
    sourceType: "shopping",
    sourceId: item.id,
    tags: item.source_wish_id ? ["shopping", "wishlist"] : ["shopping"],
    note: item.note ? `${item.note} • Dicatat dari shopping list` : "Dicatat dari shopping list",
  });
}

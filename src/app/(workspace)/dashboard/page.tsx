"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
  type FormEvent,
  type ReactNode,
} from "react";
import { ArrowRight, Clock3, ShoppingCart, Sparkles, Wallet } from "lucide-react";
import {
  ActionButton,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pill,
  SectionCard,
  Select,
} from "@/components/ui";
import type { AppSnapshot, Priority, Task, TaskStatus } from "@/lib/domain/models";
import { getEffectiveInstallmentStatus, getInstallmentPaymentAmount } from "@/lib/debts";
import {
  isTaskDueToday,
  isTaskOverdue,
  isTaskPinnedToday,
  isTaskReminderToday,
} from "@/lib/tasks";
import {
  cn,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumberInput,
  isoToday,
  parseNumberInput,
} from "@/lib/utils";
import { useAppState } from "@/providers/app-state-provider";

type AttentionModule = "task" | "debt" | "shopping" | "wishlist";

type DashboardAttentionItem = {
  id: string;
  module: AttentionModule;
  title: string;
  detail: string;
  value?: string;
  metaLabel: string;
  href: string;
  rank: number;
  dueOn?: string;
  actionLabel: string;
  actionKind: "task_done" | "debt_paid" | "shopping_bought" | "shopping_record" | "wish_move";
  tone: "neutral" | "mint" | "amber" | "rose";
  taskId?: string;
  debtId?: string;
  installmentId?: string;
  shoppingItemId?: string;
  wishId?: string;
};

type ShortcutItem = {
  label: string;
  detail: string;
  href: string;
};

function taskRank(task: Task) {
  if (isTaskOverdue(task)) return 1;
  if (isTaskDueToday(task)) return 3;
  if (isTaskPinnedToday(task) || isTaskReminderToday(task)) return 8;
  return 99;
}

function taskDetail(task: Task) {
  const context = task.projectId ? "project" : "pribadi";
  if (isTaskOverdue(task)) {
    return `Task ${context} • overdue sejak ${formatDate(task.dueOn ?? isoToday())}`;
  }
  if (isTaskDueToday(task)) {
    return `Task ${context} • due hari ini${task.dueTime ? ` jam ${task.dueTime}` : ""}`;
  }
  if (isTaskPinnedToday(task)) return `Task ${context} • di-pin ke today`;
  if (isTaskReminderToday(task)) return `Task ${context} • reminder hari ini`;
  return `Task ${context}`;
}

function taskValue(task: Task) {
  const labelByStatus: Record<TaskStatus, string> = {
    todo: "To do",
    doing: "Doing",
    done: "Done",
  };
  if (task.dueTime && isTaskDueToday(task)) return task.dueTime;
  return labelByStatus[task.status];
}

function priorityLabel(priority: Priority) {
  return { high: "prioritas tinggi", medium: "prioritas sedang", low: "prioritas rendah" }[
    priority
  ];
}

function moduleLabel(module: AttentionModule) {
  return { task: "Task", debt: "Hutang", shopping: "Belanja", wishlist: "Wishlist" }[module];
}

function rowIcon(module: AttentionModule) {
  const icons = {
    debt: <Wallet className="size-4" strokeWidth={2.2} />,
    shopping: <ShoppingCart className="size-4" strokeWidth={2.2} />,
    wishlist: <Sparkles className="size-4" strokeWidth={2.2} />,
    task: <Clock3 className="size-4" strokeWidth={2.2} />,
  };
  return icons[module] || icons.task;
}

function toneClassName(tone: DashboardAttentionItem["tone"]) {
  return {
    neutral: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
    mint: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
    amber: "bg-[rgba(218,108,44,0.14)] text-[var(--warn)]",
    rose: "bg-[rgba(166,64,77,0.14)] text-[var(--rose)]",
  }[tone];
}

function progressPercentage(spentAmount: number, targetAmount: number) {
  if (targetAmount <= 0) return 0;
  return Math.min(100, Math.round((spentAmount / targetAmount) * 100));
}

function buildAttentionItems(snapshot: AppSnapshot): DashboardAttentionItem[] {
  const today = isoToday();

  const taskItems: DashboardAttentionItem[] = snapshot.tasks
    .filter((task) => task.status !== "done")
    .filter(
      (task) =>
        isTaskOverdue(task, today) ||
        isTaskDueToday(task, today) ||
        isTaskPinnedToday(task) ||
        isTaskReminderToday(task, today),
    )
    .map((task) => ({
      id: `task-${task.id}`,
      module: "task",
      title: task.title,
      detail: taskDetail(task),
      value: taskValue(task),
      metaLabel: task.status === "doing" ? "Sedang dikerjakan" : "Task hari ini",
      href: task.projectId ? "/projects" : "/tasks",
      rank: taskRank(task),
      dueOn: task.dueOn,
      actionLabel: "Done",
      actionKind: "task_done",
      tone: isTaskOverdue(task, today) ? "rose" : "neutral",
      taskId: task.id,
    }));

  const debtItems: DashboardAttentionItem[] = snapshot.debtInstallments
    .filter((installment) => {
      const status = getEffectiveInstallmentStatus(installment);
      return status === "overdue" || status === "watch";
    })
    .map((installment) => {
      const debt = snapshot.debts.find((item) => item.id === installment.debtId);
      const status = getEffectiveInstallmentStatus(installment);
      return {
        id: `debt-${installment.id}`,
        module: "debt",
        title: debt
          ? `${debt.name} • cicilan ${installment.installmentNumber}`
          : `Cicilan ${installment.installmentNumber}`,
        detail: `${debt?.lender ?? "Hutang"} • jatuh tempo ${formatDate(installment.dueOn)}`,
        value: formatCompactCurrency(getInstallmentPaymentAmount(installment)),
        metaLabel: status === "overdue" ? "Lewat jatuh tempo" : "Segera jatuh tempo",
        href: "/debts",
        rank: status === "overdue" ? 0 : 2,
        dueOn: installment.dueOn,
        actionLabel: "Lunas",
        actionKind: "debt_paid",
        tone: status === "overdue" ? "rose" : "amber",
        debtId: installment.debtId,
        installmentId: installment.id,
      };
    });

  const shoppingItems = snapshot.shoppingItems.reduce<DashboardAttentionItem[]>(
    (items, item) => {
      const isRecorded = snapshot.transactions.some(
        (transaction) =>
          transaction.sourceType === "shopping" && transaction.sourceId === item.id,
      );

      if (item.status === "buying") {
        items.push({
          id: `shopping-${item.id}`,
          module: "shopping",
          title: item.name,
          detail: `Qty ${item.quantity} • ${item.section}${
            item.store ? ` • ${item.store}` : ""
          }${item.sourceWishId ? " • dari wishlist" : ""}`,
          value: formatCompactCurrency(item.estimatedPrice * item.quantity),
          metaLabel: "Belanja aktif",
          href: "/shopping",
          rank: 5,
          actionLabel: "Tandai sudah dibeli",
          actionKind: "shopping_bought",
          tone: "amber",
          shoppingItemId: item.id,
        });
        return items;
      }

      if (item.status === "bought" && !isRecorded) {
        items.push({
          id: `shopping-${item.id}`,
          module: "shopping",
          title: item.name,
          detail: `Sudah dibeli • ${item.section}${
            item.store ? ` • ${item.store}` : ""
          }${item.sourceWishId ? " • dari wishlist" : ""}`,
          value: formatCompactCurrency(item.estimatedPrice * item.quantity),
          metaLabel: "Belum tercatat ke finance",
          href: "/shopping",
          rank: 4,
          actionLabel: "Catat ke finance",
          actionKind: "shopping_record",
          tone: "mint",
          shoppingItemId: item.id,
        });
        return items;
      }

      return items;
    },
    [],
  );

  const wishlistItems: DashboardAttentionItem[] = snapshot.wishItems
    .filter((item) => item.status === "ready")
    .map((item) => ({
      id: `wish-${item.id}`,
      module: "wishlist",
      title: item.name,
      detail: `${priorityLabel(item.priority)} • ${item.note ?? "Siap dipindahkan ke shopping"}`,
      value: formatCompactCurrency(item.targetPrice),
      metaLabel: "Siap dibeli",
      href: "/wishlist",
      rank: item.priority === "high" ? 6 : 7,
      actionLabel: "Pindahkan ke shopping",
      actionKind: "wish_move",
      tone: "neutral",
      wishId: item.id,
    }));

  return [...debtItems, ...taskItems, ...shoppingItems, ...wishlistItems]
    .sort((left, right) => {
      const rankDiff = left.rank - right.rank;
      if (rankDiff !== 0) return rankDiff;
      if (left.dueOn && right.dueOn) {
        const dueDiff = left.dueOn.localeCompare(right.dueOn);
        if (dueDiff !== 0) return dueDiff;
      }
      if (left.dueOn && !right.dueOn) return -1;
      if (!left.dueOn && right.dueOn) return 1;
      return left.title.localeCompare(right.title);
    })
    .slice(0, 8);
}

function buildShortcuts(snapshot: AppSnapshot): ShortcutItem[] {
  const dueDebtCount = snapshot.debtInstallments.filter((installment) => {
    const status = getEffectiveInstallmentStatus(installment);
    return status === "overdue" || status === "watch";
  }).length;
  const taskCount = snapshot.tasks.filter(
    (task) =>
      task.status !== "done" &&
      (isTaskOverdue(task) ||
        isTaskDueToday(task) ||
        isTaskPinnedToday(task) ||
        isTaskReminderToday(task)),
  ).length;
  const shoppingCount = snapshot.shoppingItems.filter((item) => {
    const isRecorded = snapshot.transactions.some(
      (transaction) => transaction.sourceType === "shopping" && transaction.sourceId === item.id,
    );
    return item.status === "buying" || (item.status === "bought" && !isRecorded);
  }).length;
  const readyWishlistCount = snapshot.wishItems.filter((item) => item.status === "ready").length;
  const activeProjectsCount = snapshot.projects.filter((project) => project.status === "active")
    .length;

  return [
    { label: "Tasks", detail: `${taskCount} perlu perhatian`, href: "/tasks" },
    { label: "Debts", detail: `${dueDebtCount} cicilan dekat`, href: "/debts" },
    { label: "Shopping", detail: `${shoppingCount} item aktif`, href: "/shopping" },
    { label: "Wishlist", detail: `${readyWishlistCount} siap dibeli`, href: "/wishlist" },
    { label: "Projects", detail: `${activeProjectsCount} project aktif`, href: "/projects" },
    { label: "Notes", detail: `${snapshot.notes.length} catatan`, href: "/notes" },
  ];
}

const InlineActionButton = memo(function InlineActionButton({
  children,
  onClick,
  variant = "secondary",
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-[16px] px-4 py-2 text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-60",
        variant === "primary"
          ? "bg-[var(--accent-strong)] text-white shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:bg-[var(--accent)]"
          : "border border-[var(--border)] bg-[rgba(255,255,255,0.76)] text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-white",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
});

const QuickTransactionForm = memo(function QuickTransactionForm({
  accounts,
  categories,
  activeCycleId,
  addTransaction,
}: {
  accounts: any[];
  categories: any[];
  activeCycleId?: string;
  addTransaction: (input: any) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [feedback, setFeedback] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ amount?: string; title?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!accountId && accounts[0]?.id) {
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  function showFeedback(message: string) {
    setFeedback(message);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setFeedback(""), 2400);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: { amount?: string; title?: string } = {};
    const trimmedTitle = title.trim();
    const parsedAmount = parseNumberInput(amount);

    if (!trimmedTitle) nextErrors.title = "Isi judul transaksi dulu.";
    if (parsedAmount <= 0) nextErrors.amount = "Isi nominal dulu.";

    if (nextErrors.title || nextErrors.amount) {
      setFieldErrors(nextErrors);
      if (nextErrors.title) titleInputRef.current?.focus();
      else amountInputRef.current?.focus();
      return;
    }

    const categoryId = categories.find((cat) => cat.kind === kind)?.id;
    if (!categoryId || !accountId) {
      showFeedback("Kategori atau akun belum siap.");
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    await addTransaction({
      title: trimmedTitle,
      kind,
      amount: parsedAmount,
      occurredOn: isoToday(),
      accountId,
      categoryId,
      cycleId: activeCycleId,
    });
    setIsSubmitting(false);

    setTitle("");
    setAmount("");
    showFeedback(kind === "income" ? "Pemasukan tersimpan." : "Pengeluaran tersimpan.");
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
      <Field label="Judul transaksi">
        <div className="space-y-2">
          <Input
            className={fieldErrors.title ? "border-[var(--rose)]" : ""}
            onChange={(event) => {
              setTitle(event.target.value);
              if (fieldErrors.title && event.target.value.trim()) {
                setFieldErrors((current) => ({ ...current, title: undefined }));
              }
            }}
            placeholder="Contoh: jajan, ongkir, uang masuk"
            ref={titleInputRef}
            value={title}
          />
          {fieldErrors.title ? (
            <p className="text-xs text-[var(--rose)]">{fieldErrors.title}</p>
          ) : null}
        </div>
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Jenis">
          <Select onChange={(e) => setKind(e.target.value as any)} value={kind}>
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </Select>
        </Field>
        <Field label="Nominal">
          <div className="space-y-2">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-[var(--muted)]">
                Rp
              </span>
              <Input
                className={cn("pl-11", fieldErrors.amount ? "border-[var(--rose)]" : "")}
                inputMode="numeric"
                onChange={(event) => {
                  const val = event.target.value.replace(/\D/g, "");
                  setAmount(val);
                  if (fieldErrors.amount && parseNumberInput(val) > 0) {
                    setFieldErrors((current) => ({ ...current, amount: undefined }));
                  }
                }}
                placeholder="0"
                ref={amountInputRef}
                type="text"
                value={formatNumberInput(amount)}
              />
            </div>
            {fieldErrors.amount ? (
              <p className="text-xs text-[var(--rose)]">{fieldErrors.amount}</p>
            ) : null}
          </div>
        </Field>
        <Field label="Akun">
          <Select onChange={(e) => setAccountId(e.target.value)} value={accountId}>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton
          className="bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] text-white shadow-[0_16px_34px_rgba(26,130,121,0.18)] hover:-translate-y-0.5"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Menyimpan..." : "Simpan cepat"}
        </ActionButton>
        <ActionButton href="/finance" variant="secondary">
          Form lengkap
        </ActionButton>
        {feedback ? (
          <span className="inline-flex min-h-10 items-center rounded-[16px] border border-[rgba(26,130,121,0.18)] bg-[rgba(236,248,245,0.92)] px-3.5 py-2 text-sm text-[var(--accent-strong)] animate-[pulse_0.7s_ease-out_1]">
            {feedback}
          </span>
        ) : null}
      </div>
    </form>
  );
});

const AttentionItemComponent = memo(function AttentionItemComponent({
  item,
  isActioning,
  onAction,
}: {
  item: DashboardAttentionItem;
  isActioning: boolean;
  onAction: (item: DashboardAttentionItem) => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[22px] border border-[var(--border)] bg-white/78 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={cn("mt-1 inline-flex rounded-full p-2", toneClassName(item.tone))}>
          {rowIcon(item.module)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start gap-2">
            <Pill tone={item.tone}>{moduleLabel(item.module)}</Pill>
            <Link
              className="min-w-0 font-semibold text-[var(--foreground)] hover:text-[var(--accent-strong)] [overflow-wrap:anywhere]"
              href={item.href}
            >
              {item.title}
            </Link>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)] [overflow-wrap:anywhere]">
            {item.detail}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <div className="text-right">
          {item.value ? <p className="font-semibold">{item.value}</p> : null}
          <p className="mt-1 text-xs text-[var(--muted)]">{item.metaLabel}</p>
        </div>
        <InlineActionButton
          disabled={isActioning}
          onClick={() => onAction(item)}
          variant={item.actionKind === "shopping_record" ? "primary" : "secondary"}
        >
          {isActioning ? "Memproses..." : item.actionLabel}
        </InlineActionButton>
      </div>
    </div>
  );
});

const ShortcutItemComponent = memo(function ShortcutItemComponent({
  item,
}: {
  item: ShortcutItem;
}) {
  return (
    <Link
      className="flex items-center justify-between rounded-[22px] border border-[var(--border)] bg-white/78 px-4 py-4 transition-colors hover:bg-white"
      href={item.href}
    >
      <div>
        <p className="font-semibold">{item.label}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
      </div>
      <ArrowRight className="size-4 text-[var(--muted)]" />
    </Link>
  );
});

export default function DashboardPage() {
  const {
    snapshot,
    addTransaction,
    moveTask,
    moveWishToShopping,
    recordShoppingPurchase,
    setDebtInstallmentStatus,
    setShoppingStatus,
  } = useAppState();

  const activeCycle = snapshot.budgetCycles.find((cycle) => cycle.status === "active");
  const attentionItems = useMemo(() => buildAttentionItems(snapshot), [snapshot]);
  const shortcuts = useMemo(() => buildShortcuts(snapshot), [snapshot]);
  const totalBalance = useMemo(
    () => snapshot.accounts.reduce((sum, account) => sum + account.balance, 0),
    [snapshot.accounts],
  );

  const [actioningId, setActioningId] = useState<string | null>(null);
  const [taskCelebration, setTaskCelebration] = useState("");
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    };
  }, []);

  function celebrateTask(title: string) {
    setTaskCelebration(title);
    if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    celebrationTimeoutRef.current = setTimeout(() => setTaskCelebration(""), 1800);
  }

  async function handleAttentionAction(item: DashboardAttentionItem) {
    setActioningId(item.id);
    try {
      if (item.actionKind === "task_done" && item.taskId) {
        await moveTask(item.taskId, "done");
        celebrateTask(item.title);
      } else if (item.actionKind === "debt_paid" && item.debtId && item.installmentId) {
        await setDebtInstallmentStatus({
          debtId: item.debtId,
          installmentId: item.installmentId,
          status: "paid",
          paidOn: isoToday(),
        });
      } else if (item.actionKind === "shopping_bought" && item.shoppingItemId) {
        await setShoppingStatus({ itemId: item.shoppingItemId, status: "bought" });
      } else if (item.actionKind === "shopping_record" && item.shoppingItemId) {
        await recordShoppingPurchase(item.shoppingItemId);
      } else if (item.actionKind === "wish_move" && item.wishId) {
        await moveWishToShopping(item.wishId);
      }
    } finally {
      setActioningId(null);
    }
  }

  const cycleProgress = activeCycle
    ? progressPercentage(activeCycle.spentAmount, activeCycle.targetAmount)
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        description="Lihat keuangan, catat transaksi, dan tangani yang penting hari ini."
        eyebrow="Core flow / dashboard"
        title="Dashboard yang ringkas dan tenang."
      />

      <SectionCard
        description="Saldo, siklus aktif, dan catat transaksi tanpa pindah halaman."
        title="Keuangan cepat"
      >
        <div className="grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
          <div className="space-y-4 rounded-[24px] bg-white/74 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Total saldo
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {formatCurrency(totalBalance)}
              </p>
            </div>

            <div className="space-y-3 rounded-[20px] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Siklus aktif</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {activeCycle
                      ? `${activeCycle.label} • ${formatCompactCurrency(
                          activeCycle.spentAmount,
                        )} / ${formatCompactCurrency(activeCycle.targetAmount)}`
                      : "Belum ada siklus aktif."}
                  </p>
                </div>
                <ActionButton href="/finance" variant="ghost">
                  Buka finance
                </ActionButton>
              </div>
              <div className="h-2 rounded-full bg-[rgba(16,33,43,0.08)]">
                <div
                  className="h-2 rounded-full bg-[linear-gradient(90deg,#facc15,#2dd4bf)]"
                  style={{ width: `${cycleProgress}%` }}
                />
              </div>
              <p className="text-xs text-[var(--muted)]">
                {activeCycle
                  ? `${cycleProgress}% budget terpakai`
                  : "Progress akan muncul saat ada siklus aktif."}
              </p>
            </div>
          </div>

          <QuickTransactionForm
            accounts={snapshot.accounts}
            activeCycleId={activeCycle?.id}
            addTransaction={addTransaction}
            categories={snapshot.categories}
          />
        </div>
      </SectionCard>

      <SectionCard
        description="Item lintas modul yang perlu Anda lihat hari ini."
        title="Butuh perhatian hari ini"
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Pill tone={attentionItems.length ? "mint" : "neutral"}>
            {attentionItems.length} item
          </Pill>
          {taskCelebration ? (
            <p className="inline-flex items-center gap-2 rounded-full border border-[rgba(26,130,121,0.18)] bg-[rgba(236,248,245,0.92)] px-3.5 py-2 text-sm text-[var(--accent-strong)] animate-[pulse_0.8s_ease-out_1]">
              <Sparkles className="size-4" strokeWidth={2.1} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{taskCelebration} selesai.</span>
            </p>
          ) : null}
        </div>

        {attentionItems.length ? (
          <div className="space-y-3">
            {attentionItems.map((item) => (
              <AttentionItemComponent
                isActioning={actioningId === item.id}
                key={item.id}
                item={item}
                onAction={handleAttentionAction}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            description="Saat ada hal penting lintas modul, item-nya akan muncul di sini."
            title="Tidak ada item mendesak hari ini."
          />
        )}
      </SectionCard>

      <SectionCard description="Buka modul kerja utama dari sini." title="Shortcut modul">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((item) => (
            <ShortcutItemComponent key={item.label} item={item} />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

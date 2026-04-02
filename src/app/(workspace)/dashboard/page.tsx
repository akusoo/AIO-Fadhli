"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
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
import type {
  AppSnapshot,
  Priority,
  Task,
  TaskStatus,
} from "@/lib/domain/models";
import {
  getEffectiveInstallmentStatus,
  getInstallmentPaymentAmount,
} from "@/lib/debts";
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
  actionKind:
    | "task_done"
    | "debt_paid"
    | "shopping_bought"
    | "shopping_record"
    | "wish_move";
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
  if (isTaskOverdue(task)) {
    return 1;
  }

  if (isTaskDueToday(task)) {
    return 3;
  }

  if (isTaskPinnedToday(task) || isTaskReminderToday(task)) {
    return 8;
  }

  return 99;
}

function taskDetail(task: Task) {
  if (isTaskOverdue(task)) {
    return `Task ${task.projectId ? "project" : "pribadi"} • overdue sejak ${formatDate(
      task.dueOn ?? isoToday(),
    )}`;
  }

  if (isTaskDueToday(task)) {
    return `Task ${task.projectId ? "project" : "pribadi"} • due hari ini${
      task.dueTime ? ` jam ${task.dueTime}` : ""
    }`;
  }

  if (isTaskPinnedToday(task)) {
    return `Task ${task.projectId ? "project" : "pribadi"} • dipin ke Today`;
  }

  if (isTaskReminderToday(task)) {
    return `Task ${task.projectId ? "project" : "pribadi"} • reminder hari ini`;
  }

  return `Task ${task.projectId ? "project" : "pribadi"}`;
}

function taskValue(task: Task) {
  const labelByStatus: Record<TaskStatus, string> = {
    todo: "To do",
    doing: "Doing",
    done: "Done",
  };

  if (task.dueTime && isTaskDueToday(task)) {
    return task.dueTime;
  }

  return labelByStatus[task.status];
}

function priorityLabel(priority: Priority) {
  return {
    high: "prioritas tinggi",
    medium: "prioritas sedang",
    low: "prioritas rendah",
  }[priority];
}

function moduleLabel(module: AttentionModule) {
  return {
    task: "Task",
    debt: "Hutang",
    shopping: "Belanja",
    wishlist: "Wishlist",
  }[module];
}

function rowIcon(module: AttentionModule) {
  if (module === "debt") {
    return <Wallet className="size-4" strokeWidth={2.2} />;
  }

  if (module === "shopping") {
    return <ShoppingCart className="size-4" strokeWidth={2.2} />;
  }

  if (module === "wishlist") {
    return <Sparkles className="size-4" strokeWidth={2.2} />;
  }

  return <Clock3 className="size-4" strokeWidth={2.2} />;
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
  if (targetAmount <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((spentAmount / targetAmount) * 100));
}

function buildAttentionItems(snapshot: AppSnapshot) {
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
      module: "task" as const,
      title: task.title,
      detail: taskDetail(task),
      value: taskValue(task),
      metaLabel: task.status === "doing" ? "Sedang dikerjakan" : "Task hari ini",
      href: task.projectId ? "/projects" : "/tasks",
      rank: taskRank(task),
      dueOn: task.dueOn,
      actionLabel: "Done",
      actionKind: "task_done" as const,
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
        module: "debt" as const,
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
        actionKind: "debt_paid" as const,
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
      module: "wishlist" as const,
      title: item.name,
      detail: `${priorityLabel(item.priority)} • ${item.note ?? "Siap dipindahkan ke shopping"}`,
      value: formatCompactCurrency(item.targetPrice),
      metaLabel: "Siap dibeli",
      href: "/wishlist",
      rank: item.priority === "high" ? 6 : 7,
      actionLabel: "Pindahkan ke shopping",
      actionKind: "wish_move" as const,
      tone: "neutral" as const,
      wishId: item.id,
    }));

  return [...debtItems, ...taskItems, ...shoppingItems, ...wishlistItems]
    .sort((left, right) => {
      const rankDiff = left.rank - right.rank;

      if (rankDiff !== 0) {
        return rankDiff;
      }

      if (left.dueOn && right.dueOn) {
        const dueDiff = left.dueOn.localeCompare(right.dueOn);

        if (dueDiff !== 0) {
          return dueDiff;
        }
      }

      if (left.dueOn && !right.dueOn) {
        return -1;
      }

      if (!left.dueOn && right.dueOn) {
        return 1;
      }

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
      (transaction) =>
        transaction.sourceType === "shopping" && transaction.sourceId === item.id,
    );
    return item.status === "buying" || (item.status === "bought" && !isRecorded);
  }).length;
  const readyWishlistCount = snapshot.wishItems.filter((item) => item.status === "ready").length;
  const activeProjectsCount = snapshot.projects.filter((project) => project.status === "active")
    .length;

  return [
    {
      label: "Tasks",
      detail: `${taskCount} perlu perhatian`,
      href: "/tasks",
    },
    {
      label: "Debts",
      detail: `${dueDebtCount} cicilan dekat`,
      href: "/debts",
    },
    {
      label: "Shopping",
      detail: `${shoppingCount} item aktif`,
      href: "/shopping",
    },
    {
      label: "Wishlist",
      detail: `${readyWishlistCount} siap dibeli`,
      href: "/wishlist",
    },
    {
      label: "Projects",
      detail: `${activeProjectsCount} project aktif`,
      href: "/projects",
    },
    {
      label: "Notes",
      detail: `${snapshot.notes.length} catatan`,
      href: "/notes",
    },
  ];
}

function InlineActionButton({
  children,
  onClick,
  variant = "secondary",
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-[16px] px-4 py-2 text-sm font-medium transition-all duration-150",
        variant === "primary"
          ? "bg-[var(--foreground)] text-white shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
          : "border border-[var(--border)] bg-[rgba(255,255,255,0.76)] text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-white",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

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
  const totalBalance = snapshot.accounts.reduce((sum, account) => sum + account.balance, 0);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? "");
  const [feedback, setFeedback] = useState("");

  async function handleQuickTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const categoryId = snapshot.categories.find((category) => category.kind === kind)?.id;

    if (!categoryId) {
      return;
    }

    await addTransaction({
      title,
      kind,
      amount: parseNumberInput(amount),
      occurredOn: isoToday(),
      accountId,
      categoryId,
      cycleId: activeCycle?.id,
    });

    setTitle("");
    setAmount("");
    setFeedback(
      kind === "income"
        ? "Pemasukan cepat tersimpan."
        : "Pengeluaran cepat tersimpan.",
    );
  }

  async function handleAttentionAction(item: DashboardAttentionItem) {
    if (item.actionKind === "task_done" && item.taskId) {
      await moveTask(item.taskId, "done");
      return;
    }

    if (item.actionKind === "debt_paid" && item.debtId && item.installmentId) {
      await setDebtInstallmentStatus({
        debtId: item.debtId,
        installmentId: item.installmentId,
        status: "paid",
        paidOn: isoToday(),
      });
      return;
    }

    if (item.actionKind === "shopping_bought" && item.shoppingItemId) {
      await setShoppingStatus({
        itemId: item.shoppingItemId,
        status: "bought",
      });
      return;
    }

    if (item.actionKind === "shopping_record" && item.shoppingItemId) {
      await recordShoppingPurchase(item.shoppingItemId);
      return;
    }

    if (item.actionKind === "wish_move" && item.wishId) {
      await moveWishToShopping(item.wishId);
    }
  }

  const cycleProgress = activeCycle
    ? progressPercentage(activeCycle.spentAmount, activeCycle.targetAmount)
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Core flow / dashboard"
        title="Halaman masuk yang ringkas untuk melihat apa yang perlu perhatian."
        description="Fokus ke kondisi keuangan sekarang, transaksi cepat, dan item lintas modul yang paling layak ditangani hari ini."
      />

      <SectionCard
        description="Saldo, siklus aktif, dan catat transaksi cepat tanpa membuka halaman finance penuh."
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

          <form className="grid gap-4" onSubmit={handleQuickTransaction}>
            <Field label="Judul transaksi">
              <Input
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Contoh: jajan, ongkir, uang masuk"
                required
                value={title}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Jenis">
                <Select
                  onChange={(event) => setKind(event.target.value as "income" | "expense")}
                  value={kind}
                >
                  <option value="expense">Pengeluaran</option>
                  <option value="income">Pemasukan</option>
                </Select>
              </Field>
              <Field label="Nominal">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-[var(--muted)]">
                    Rp
                  </span>
                  <Input
                    className="pl-11"
                    inputMode="numeric"
                    onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
                    placeholder="0"
                    required
                    type="text"
                    value={formatNumberInput(amount)}
                  />
                </div>
              </Field>
              <Field label="Akun">
                <Select
                  onChange={(event) => setAccountId(event.target.value)}
                  value={accountId}
                >
                  {snapshot.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ActionButton type="submit">Simpan cepat</ActionButton>
              <ActionButton href="/finance" variant="secondary">
                Form lengkap
              </ActionButton>
            </div>
            {feedback ? (
              <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                {feedback}
              </p>
            ) : null}
          </form>
        </div>
      </SectionCard>

      <SectionCard
        description="Prioritas lintas modul yang paling layak ditangani dulu."
        title="Butuh perhatian hari ini"
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Pill tone={attentionItems.length ? "mint" : "neutral"}>
            {attentionItems.length} item ditampilkan
          </Pill>
          <p className="text-sm text-[var(--muted)]">
            Maksimal 8 item agar dashboard tetap mudah discan.
          </p>
        </div>

        {attentionItems.length ? (
          <div className="space-y-3">
            {attentionItems.map((item) => (
              <div
                className="flex flex-col gap-4 rounded-[22px] border border-[var(--border)] bg-white/78 p-4 md:flex-row md:items-center md:justify-between"
                key={item.id}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className={cn(
                      "mt-1 inline-flex rounded-full p-2",
                      toneClassName(item.tone),
                    )}
                  >
                    {rowIcon(item.module)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={item.tone}>{moduleLabel(item.module)}</Pill>
                      <Link
                        className="font-semibold text-[var(--foreground)] hover:text-[var(--accent-strong)]"
                        href={item.href}
                      >
                        {item.title}
                      </Link>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">{item.detail}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <div className="text-right">
                    {item.value ? <p className="font-semibold">{item.value}</p> : null}
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.metaLabel}</p>
                  </div>
                  <InlineActionButton
                    onClick={() => {
                      void handleAttentionAction(item);
                    }}
                    variant={item.actionKind === "shopping_record" ? "primary" : "secondary"}
                  >
                    {item.actionLabel}
                  </InlineActionButton>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Tidak ada item mendesak hari ini."
            description="Dashboard akan menampilkan task, cicilan, wishlist siap beli, dan belanja aktif saat ada yang perlu ditangani."
          />
        )}
      </SectionCard>

      <SectionCard
        description="Jalan cepat ke halaman kerja masing-masing tanpa menambah panel yang berat."
        title="Shortcut modul"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((item) => (
            <Link
              className="flex items-center justify-between rounded-[22px] border border-[var(--border)] bg-white/78 px-4 py-4 transition-colors hover:bg-white"
              href={item.href}
              key={item.label}
            >
              <div>
                <p className="font-semibold">{item.label}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
              </div>
              <ArrowRight className="size-4 text-[var(--muted)]" />
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

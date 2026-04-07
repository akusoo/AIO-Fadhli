"use client";

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarRange,
  ChartColumn,
  Landmark,
  PencilLine,
  Repeat2,
  Search,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  ActionButton,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pill,
  SectionCard,
  Select,
  Textarea,
} from "@/components/ui";
import {
  getInstallmentPaymentAmount,
  getOpenInstallments,
} from "@/lib/debts";
import {
  buildCategoryBudgetSummary,
  filterTransactions,
  getAccountMovement,
  getActiveCycle,
  getCashflowPoints,
  getFinanceOverview,
  getForecastItems,
  getInvestmentAllocationByInstrument,
  getInvestmentAllocationByPlatform,
  getInvestmentDistributionByAccount,
  getInvestmentSummary,
  getInvestmentTopGainers,
  getInvestmentTopLosers,
  getInvestmentTrend,
  getMerchants,
  getMonths,
  getMonthlyCategorySpendPoints,
  getTransactionTags,
  getUpcomingFinanceItems,
  resolveAccountName,
} from "@/lib/finance";
import { useAppState } from "@/providers/app-state-provider";
import {
  cn,
  formatCurrency,
  formatDate,
  formatNumberInput,
  isoToday,
  parseNumberInput,
} from "@/lib/utils";

type FinanceTab =
  | "overview"
  | "transactions"
  | "planning"
  | "reports"
  | "investments"
  | "accounts";
type PreviewScope = "cycle" | "month";
type FinanceSettingsSection = "accounts" | "categories" | "cycles";
type QuickAddNoticeTone = "success" | "error";

const financeTabs: Array<{ id: FinanceTab; label: string; icon: typeof WalletCards }> = [
  { id: "overview", label: "Overview", icon: WalletCards },
  { id: "transactions", label: "Transactions", icon: Search },
  { id: "planning", label: "Planning", icon: CalendarRange },
  { id: "reports", label: "Reports", icon: ChartColumn },
  { id: "investments", label: "Investments", icon: TrendingUp },
  { id: "accounts", label: "Accounts", icon: Landmark },
];

const financeSettingsSections: Array<{
  description: string;
  icon: typeof WalletCards;
  id: FinanceSettingsSection;
  label: string;
}> = [
  {
    id: "accounts",
    label: "Akun",
    icon: Landmark,
    description: "Saldo aktif dan pergerakan akun.",
  },
  {
    id: "categories",
    label: "Kategori",
    icon: ChartColumn,
    description: "Kelola kelompok income dan expense.",
  },
  {
    id: "cycles",
    label: "Budget cycle",
    icon: CalendarRange,
    description: "Atur periode budget dan status aktif.",
  },
];

function transactionSourceLabel(sourceType?: "shopping" | "debt_installment" | "investment") {
  return {
    shopping: "sinkron shopping",
    debt_installment: "sinkron hutang",
    investment: "sinkron investasi",
  }[sourceType ?? "shopping"];
}

function isTransactionSourceStillAvailable(
  snapshot: ReturnType<typeof useAppState>["snapshot"],
  transaction: ReturnType<typeof useAppState>["snapshot"]["transactions"][number],
) {
  if (!transaction.sourceType || !transaction.sourceId) {
    return false;
  }

  if (transaction.sourceType === "shopping") {
    return snapshot.shoppingItems.some((item) => item.id === transaction.sourceId);
  }

  if (transaction.sourceType === "debt_installment") {
    return snapshot.debtInstallments.some((item) => item.id === transaction.sourceId);
  }

  if (transaction.sourceType === "investment") {
    return snapshot.investments.some((item) => item.id === transaction.sourceId);
  }

  return false;
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof WalletCards;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--accent-strong)] text-white"
          : "border border-[var(--border)] bg-white/75 text-[var(--foreground)] hover:bg-white",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" strokeWidth={2.2} />
      {label}
    </button>
  );
}

function PreviewToggle({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-full px-3 py-2 text-xs font-medium transition-colors",
        active
          ? "bg-[var(--accent-strong)] text-white"
          : "border border-[var(--border)] bg-white/80 text-[var(--foreground)] hover:bg-white",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-white/82 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        {title}
      </p>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function ValueBar({
  label,
  value,
  tone,
  width,
  helper,
}: {
  label: string;
  value: string;
  tone: "mint" | "amber" | "ink";
  width: number;
  helper?: string;
}) {
  const colorClassName = {
    mint: "bg-[linear-gradient(90deg,#86efac,#2dd4bf)]",
    amber: "bg-[linear-gradient(90deg,#fde68a,#fb923c)]",
    ink: "bg-[linear-gradient(90deg,#7dd3fc,#0f766e)]",
  }[tone];

  return (
    <div className="space-y-2 rounded-[20px] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
      <div className="h-3 rounded-full bg-[rgba(16,33,43,0.08)]">
        <div
          className={cn("h-3 rounded-full", colorClassName)}
          style={{ width: `${Math.max(6, Math.min(100, width))}%` }}
        />
      </div>
      {helper ? <p className="text-xs text-[var(--muted)]">{helper}</p> : null}
    </div>
  );
}

export default function FinancePage() {
  const {
    snapshot,
    addAccount,
    deleteAccount,
    updateAccount,
    addInvestment,
    addInvestmentValuation,
    addBudgetCycle,
    addCategory,
    deleteInvestment,
    updateBudgetCycle,
    updateTransaction,
    deleteTransaction,
    updateInvestment,
    addRecurringPlan,
    addTransaction,
  } = useAppState();
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [transactionTitle, setTransactionTitle] = useState("");
  const [editingTransactionId, setEditingTransactionId] = useState("");
  const [transactionKind, setTransactionKind] = useState<"income" | "expense" | "transfer">(
    "expense",
  );
  const [transactionAmount, setTransactionAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(isoToday());
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? "");
  const [transferTargetAccountId, setTransferTargetAccountId] = useState(
    snapshot.accounts[1]?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState(snapshot.categories[1]?.id ?? "");
  const [cycleId, setCycleId] = useState(getActiveCycle(snapshot)?.id ?? "");
  const [merchant, setMerchant] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [transactionFeedback, setTransactionFeedback] = useState("");
  const [quickAddNotice, setQuickAddNotice] = useState<{
    message: string;
    tone: QuickAddNoticeTone;
  } | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [filterKind, setFilterKind] = useState("all");
  const [filterAccountId, setFilterAccountId] = useState("all");
  const [filterCategoryId, setFilterCategoryId] = useState("all");
  const [filterMerchant, setFilterMerchant] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [overviewCategoryScope, setOverviewCategoryScope] = useState<PreviewScope>("cycle");
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<FinanceSettingsSection>("accounts");
  const [reportScope, setReportScope] = useState<"cycle" | "month">("cycle");
  const [reportMonth, setReportMonth] = useState("2026-03");
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [recurringLabel, setRecurringLabel] = useState("");
  const [recurringKind, setRecurringKind] = useState<"income" | "expense">("expense");
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringCadence, setRecurringCadence] = useState<"weekly" | "monthly" | "custom">(
    "monthly",
  );
  const [recurringDate, setRecurringDate] = useState("2026-04-01");
  const [recurringAccountId, setRecurringAccountId] = useState(snapshot.accounts[0]?.id ?? "");
  const [recurringCategoryId, setRecurringCategoryId] = useState(
    snapshot.categories.find((category) => category.kind === "expense")?.id ?? "",
  );
  const [recurringMerchant, setRecurringMerchant] = useState("");
  const [recurringTags, setRecurringTags] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<"cash" | "bank" | "e-wallet">("bank");
  const [accountBalance, setAccountBalance] = useState("");
  const [accountFeedback, setAccountFeedback] = useState("");
  const [editingAccountId, setEditingAccountId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryKind, setCategoryKind] = useState<"income" | "expense">("expense");
  const [categoryFeedback, setCategoryFeedback] = useState("");
  const [cycleLabelInput, setCycleLabelInput] = useState("");
  const [cycleStartOnInput, setCycleStartOnInput] = useState(isoToday());
  const [cycleEndOnInput, setCycleEndOnInput] = useState(isoToday());
  const [cycleTargetAmountInput, setCycleTargetAmountInput] = useState("");
  const [cycleStatusInput, setCycleStatusInput] = useState<"active" | "planned" | "completed">(
    "active",
  );
  const [cycleFeedback, setCycleFeedback] = useState("");
  const [editingCycleId, setEditingCycleId] = useState("");
  const [investmentName, setInvestmentName] = useState("");
  const [investmentPlatform, setInvestmentPlatform] = useState("");
  const [investmentInstrument, setInvestmentInstrument] = useState<
    "stock" | "fund" | "bond" | "crypto" | "gold" | "money-market" | "other"
  >("stock");
  const [investmentStartDate, setInvestmentStartDate] = useState(isoToday());
  const [investmentInvestedAmount, setInvestmentInvestedAmount] = useState("");
  const [investmentCurrentValue, setInvestmentCurrentValue] = useState("");
  const [investmentAccountId, setInvestmentAccountId] = useState(snapshot.accounts[0]?.id ?? "");
  const [investmentTags, setInvestmentTags] = useState("");
  const [investmentNote, setInvestmentNote] = useState("");
  const [investmentSyncTransaction, setInvestmentSyncTransaction] = useState(false);
  const [investmentStatus, setInvestmentStatus] = useState<"active" | "paused" | "closed">("active");
  const [editingInvestmentId, setEditingInvestmentId] = useState("");
  const [valuationInvestmentId, setValuationInvestmentId] = useState("");
  const [valuationDate, setValuationDate] = useState(isoToday());
  const [valuationCurrentValue, setValuationCurrentValue] = useState("");
  const [valuationNote, setValuationNote] = useState("");
  const [valuationSyncTransaction, setValuationSyncTransaction] = useState(false);
  const [investmentFeedback, setInvestmentFeedback] = useState("");
  const [investmentStatusFilter, setInvestmentStatusFilter] = useState<
    "all" | "active" | "paused" | "closed"
  >("all");

  const overview = useMemo(() => getFinanceOverview(snapshot, reportMonth), [snapshot, reportMonth]);
  const activeCycle = useMemo(() => getActiveCycle(snapshot), [snapshot]);
  const upcomingItems = useMemo(() => getUpcomingFinanceItems(snapshot).slice(0, 7), [snapshot]);
  const forecastItems = useMemo(() => getForecastItems(snapshot), [snapshot]);
  const categoryBudgetSummary = useMemo(
    () =>
      activeCycle
        ? snapshot.budgetCategoryAllocations
            .filter((allocation) => allocation.cycleId === activeCycle.id)
            .map((allocation) => buildCategoryBudgetSummary(snapshot, allocation))
        : [],
    [activeCycle, snapshot],
  );
  const categoryPreview = useMemo(
    () =>
      (overviewCategoryScope === "cycle"
        ? categoryBudgetSummary.map((item) => ({
            categoryId: item.categoryId,
            label: item.label,
            spentAmount: item.spentAmount,
            allocatedAmount: item.allocatedAmount,
          }))
        : getMonthlyCategorySpendPoints(snapshot, reportMonth)
      ).slice(0, 6),
    [categoryBudgetSummary, overviewCategoryScope, reportMonth, snapshot],
  );
  const reportCategoryPreview = useMemo(
    () =>
      (reportScope === "cycle"
        ? categoryBudgetSummary.map((item) => ({
            categoryId: item.categoryId,
            label: item.label,
            spentAmount: item.spentAmount,
            allocatedAmount: item.allocatedAmount,
          }))
        : getMonthlyCategorySpendPoints(snapshot, reportMonth)
      ).slice(0, 6),
    [categoryBudgetSummary, reportMonth, reportScope, snapshot],
  );
  const cashflowPoints = useMemo(() => getCashflowPoints(snapshot, reportMonth), [snapshot, reportMonth]);
  const availableMonths = useMemo(() => getMonths(snapshot), [snapshot]);
  const availableTags = useMemo(() => getTransactionTags(snapshot), [snapshot]);
  const availableMerchants = useMemo(() => getMerchants(snapshot.transactions), [snapshot.transactions]);
  const filteredTransactions = useMemo(
    () =>
      filterTransactions(snapshot.transactions, {
        search: deferredSearch,
        kind: filterKind,
        accountId: filterAccountId,
        categoryId: filterCategoryId,
        merchant: filterMerchant,
        tag: filterTag,
        month: filterMonth,
        occurredOn: filterDate,
      }),
    [
      deferredSearch,
      filterAccountId,
      filterCategoryId,
      filterDate,
      filterKind,
      filterMerchant,
      filterMonth,
      filterTag,
      snapshot.transactions,
    ],
  );

  function resetTransactionForm() {
    setEditingTransactionId("");
    setTransactionTitle("");
    setTransactionKind("expense");
    setTransactionAmount("");
    setOccurredOn(isoToday());
    setAccountId(snapshot.accounts[0]?.id ?? "");
    setTransferTargetAccountId(snapshot.accounts[1]?.id ?? "");
    setCategoryId(snapshot.categories.find((category) => category.kind === "expense")?.id ?? "");
    setCycleId(getActiveCycle(snapshot)?.id ?? "");
    setMerchant("");
    setTags("");
    setNote("");
  }

  function startEditTransaction(transactionId: string) {
    const transaction = snapshot.transactions.find((item) => item.id === transactionId);

    if (!transaction) {
      return;
    }

    if (transaction.sourceType) {
      setTransactionFeedback(
        `Transaksi ini sinkron dari ${transactionSourceLabel(transaction.sourceType)}. Edit dari modul sumbernya supaya data tetap konsisten.`,
      );
      return;
    }

    setEditingTransactionId(transaction.id);
    setTransactionTitle(transaction.title);
    setTransactionKind(transaction.kind);
    setTransactionAmount(String(transaction.amount));
    setOccurredOn(transaction.occurredOn);
    setAccountId(transaction.accountId);
    setTransferTargetAccountId(
      transaction.transferTargetAccountId ??
        snapshot.accounts.find((account) => account.id !== transaction.accountId)?.id ??
        "",
    );
    setCategoryId(transaction.categoryId ?? "");
    setCycleId(transaction.cycleId ?? "");
    setMerchant(transaction.merchant ?? "");
    setTags((transaction.tags ?? []).join(", "));
    setNote(transaction.note ?? "");
    setActiveTab("overview");
    setTransactionFeedback(`Mode edit aktif untuk "${transaction.title}".`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const transactionInput = {
      title: transactionTitle,
      kind: transactionKind,
      amount: parseNumberInput(transactionAmount),
      occurredOn,
      accountId,
      categoryId: transactionKind === "transfer" ? undefined : categoryId,
      cycleId: cycleId || undefined,
      merchant: merchant || undefined,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      note: note || undefined,
      transferTargetAccountId:
        transactionKind === "transfer" ? transferTargetAccountId || undefined : undefined,
    } as const;

    try {
      if (editingTransactionId) {
        await updateTransaction({
          transactionId: editingTransactionId,
          ...transactionInput,
        });
        resetTransactionForm();
        const message = "Transaksi berhasil diperbarui dan saldo langsung disinkronkan ulang.";
        setTransactionFeedback(message);
        showQuickAddNotice(message, "success");
        return;
      }

      await addTransaction(transactionInput);

      resetTransactionForm();
      const message = "Transaksi tersimpan dan seluruh section finance langsung ikut terbarui.";
      setTransactionFeedback(message);
      showQuickAddNotice(message, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan transaksi.";
      setTransactionFeedback(message);
      showQuickAddNotice(message, "error");
    }
  }

  async function handleDeleteTransaction(transactionId: string) {
    const transaction = snapshot.transactions.find((item) => item.id === transactionId);

    if (!transaction) {
      return;
    }

    if (transaction.sourceType && isTransactionSourceStillAvailable(snapshot, transaction)) {
      setTransactionFeedback(
        `Transaksi ini sinkron dari ${transactionSourceLabel(transaction.sourceType)}. Hapus dari modul sumbernya supaya data tetap konsisten.`,
      );
      return;
    }

    const shouldDelete = window.confirm(
      `Hapus transaksi "${transaction.title}"? Saldo akun dan budget cycle akan disesuaikan otomatis.`,
    );

    if (!shouldDelete) {
      return;
    }

    await deleteTransaction(transactionId);

    if (editingTransactionId === transactionId) {
      resetTransactionForm();
    }

    setTransactionFeedback("Transaksi dihapus dan saldo finance sudah dikoreksi otomatis.");
  }

  async function handleRecurringSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await addRecurringPlan({
      label: recurringLabel,
      kind: recurringKind,
      amount: parseNumberInput(recurringAmount),
      cadence: recurringCadence,
      nextOccurrenceOn: recurringDate,
      accountId: recurringAccountId,
      categoryId: recurringCategoryId || undefined,
      merchant: recurringMerchant || undefined,
      tags: recurringTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });

    setRecurringLabel("");
    setRecurringAmount("");
    setRecurringMerchant("");
    setRecurringTags("");
    setShowRecurringForm(false);
  }

  async function handleAddAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const accountInput = {
      name: accountName.trim(),
      type: accountType,
      balance: parseNumberInput(accountBalance),
    } as const;

    if (editingAccountId) {
      await updateAccount({
        accountId: editingAccountId,
        ...accountInput,
      });
      resetAccountForm();
      setAccountFeedback("Akun berhasil diperbarui.");
      return;
    }

    const createdAccountId = await addAccount(accountInput);

    setAccountId(createdAccountId);
    setRecurringAccountId(createdAccountId);
    setAccountName("");
    setAccountBalance("");
    setAccountFeedback("Akun baru sudah masuk ke Finance dan langsung bisa dipakai.");
  }

  function resetAccountForm() {
    setEditingAccountId("");
    setAccountName("");
    setAccountType("bank");
    setAccountBalance("");
  }

  function startEditAccount(accountIdToEdit: string) {
    const account = snapshot.accounts.find((item) => item.id === accountIdToEdit);

    if (!account) {
      return;
    }

    setEditingAccountId(account.id);
    setAccountName(account.name);
    setAccountType(account.type);
    setAccountBalance(String(account.balance));
    setAccountFeedback(`Mode edit aktif untuk akun \"${account.name}\".`);
  }

  async function handleDeleteAccount(accountIdToDelete: string) {
    if (snapshot.accounts.length <= 1) {
      setAccountFeedback("Minimal harus ada satu akun aktif.");
      return;
    }

    const account = snapshot.accounts.find((item) => item.id === accountIdToDelete);

    if (!account) {
      return;
    }

    const shouldDelete = window.confirm(
      `Hapus akun "${account.name}"? Pastikan akun ini sudah tidak dipakai transaksi, investasi, atau recurring plan.`,
    );

    if (!shouldDelete) {
      return;
    }

    const fallbackAccountId =
      snapshot.accounts.find((item) => item.id !== accountIdToDelete)?.id ?? "";

    await deleteAccount(accountIdToDelete);

    if (editingAccountId === accountIdToDelete) {
      resetAccountForm();
    }

    if (accountId === accountIdToDelete) {
      setAccountId(fallbackAccountId);
    }

    if (recurringAccountId === accountIdToDelete) {
      setRecurringAccountId(fallbackAccountId);
    }

    if (investmentAccountId === accountIdToDelete) {
      setInvestmentAccountId(fallbackAccountId);
    }

    if (transferTargetAccountId === accountIdToDelete) {
      setTransferTargetAccountId(
        snapshot.accounts.find(
          (item) => item.id !== accountIdToDelete && item.id !== accountId,
        )?.id ?? fallbackAccountId,
      );
    }

    setAccountFeedback(`Akun "${account.name}" berhasil dihapus.`);
  }

  async function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const createdCategoryId = await addCategory({
      name: categoryName.trim(),
      kind: categoryKind,
    });

    if (transactionKind !== "transfer" && transactionKind === categoryKind) {
      setCategoryId(createdCategoryId);
    }

    if (recurringKind === categoryKind) {
      setRecurringCategoryId(createdCategoryId);
    }

    setCategoryName("");
    setCategoryFeedback("Kategori baru sudah siap dipakai untuk transaksi dan recurring.");
  }

  async function handleAddBudgetCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cycleInput = {
      label: cycleLabelInput.trim(),
      startOn: cycleStartOnInput,
      endOn: cycleEndOnInput,
      targetAmount: parseNumberInput(cycleTargetAmountInput),
      status: cycleStatusInput,
    } as const;

    if (editingCycleId) {
      await updateBudgetCycle({
        cycleId: editingCycleId,
        ...cycleInput,
      });
      if (cycleStatusInput === "active") {
        setCycleId(editingCycleId);
      }
      resetCycleForm();
      setCycleFeedback("Budget cycle berhasil diperbarui.");
      return;
    }

    const createdCycleId = await addBudgetCycle(cycleInput);

    setCycleId(createdCycleId);
    resetCycleForm();
    setCycleFeedback(
      cycleStatusInput === "active"
        ? "Cycle baru aktif. Cycle aktif sebelumnya otomatis dipindahkan ke completed."
        : "Cycle baru sudah ditambahkan ke daftar budget.",
    );
  }

  function resetCycleForm() {
    setEditingCycleId("");
    setCycleLabelInput("");
    setCycleStartOnInput(isoToday());
    setCycleEndOnInput(isoToday());
    setCycleTargetAmountInput("");
    setCycleStatusInput("active");
  }

  function startEditCycle(cycleIdToEdit: string) {
    const cycle = snapshot.budgetCycles.find((item) => item.id === cycleIdToEdit);

    if (!cycle) {
      return;
    }

    setEditingCycleId(cycle.id);
    setCycleLabelInput(cycle.label);
    setCycleStartOnInput(cycle.startOn);
    setCycleEndOnInput(cycle.endOn);
    setCycleTargetAmountInput(String(cycle.targetAmount));
    setCycleStatusInput(cycle.status);
    setActiveSettingsSection("cycles");
    setCycleFeedback(`Mode edit aktif untuk ${cycle.label}.`);
  }

  async function handleAddInvestment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const tags = investmentTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (editingInvestmentId) {
      await updateInvestment({
        investmentId: editingInvestmentId,
        name: investmentName.trim(),
        platform: investmentPlatform.trim(),
        instrument: investmentInstrument,
        status: investmentStatus,
        accountId: investmentAccountId,
        tags,
        note: investmentNote || undefined,
      });

      setInvestmentFeedback("Investasi berhasil diperbarui.");
      setEditingInvestmentId("");
      setInvestmentStatus("active");
      setInvestmentSyncTransaction(false);
      return;
    }

    await addInvestment({
      name: investmentName.trim(),
      platform: investmentPlatform.trim(),
      instrument: investmentInstrument,
      startDate: investmentStartDate,
      investedAmount: parseNumberInput(investmentInvestedAmount),
      currentValue: parseNumberInput(investmentCurrentValue),
      accountId: investmentAccountId,
      tags,
      note: investmentNote || undefined,
      syncToTransaction: investmentSyncTransaction,
    });

    setInvestmentName("");
    setInvestmentPlatform("");
    setInvestmentInvestedAmount("");
    setInvestmentCurrentValue("");
    setInvestmentTags("");
    setInvestmentNote("");
    setInvestmentStatus("active");
    setInvestmentSyncTransaction(false);
    setInvestmentFeedback(
      investmentSyncTransaction
        ? "Investasi tersimpan. Akun investasi otomatis dibuat, modal awal tercatat sebagai transfer, dan saldo akun pembayaran langsung berkurang."
        : "Investasi tersimpan. Akun investasi otomatis dibuat dan langsung masuk ke ringkasan portofolio.",
    );
  }

  function startEditInvestment(investmentId: string) {
    const investment = snapshot.investments.find((item) => item.id === investmentId);

    if (!investment) {
      return;
    }

    setEditingInvestmentId(investment.id);
    setInvestmentName(investment.name);
    setInvestmentPlatform(investment.platform);
    setInvestmentInstrument(investment.instrument);
    setInvestmentStatus(investment.status);
    setInvestmentStartDate(investment.startDate);
    setInvestmentInvestedAmount(String(investment.investedAmount));
    setInvestmentCurrentValue(String(investment.currentValue));
    setInvestmentAccountId(investment.accountId);
    setInvestmentTags((investment.tags ?? []).join(", "));
    setInvestmentNote(investment.note ?? "");
    setInvestmentSyncTransaction(false);
    setInvestmentFeedback(`Mode edit aktif untuk ${investment.name}.`);
  }

  function cancelEditInvestment() {
    setEditingInvestmentId("");
    setInvestmentName("");
    setInvestmentPlatform("");
    setInvestmentInstrument("stock");
    setInvestmentStatus("active");
    setInvestmentStartDate(isoToday());
    setInvestmentInvestedAmount("");
    setInvestmentCurrentValue("");
    setInvestmentAccountId(snapshot.accounts[0]?.id ?? "");
    setInvestmentTags("");
    setInvestmentNote("");
    setInvestmentSyncTransaction(false);
    setInvestmentFeedback("Mode edit dibatalkan.");
  }

  async function handleAddValuation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const targetInvestmentId = valuationInvestmentId || snapshot.investments[0]?.id;

    if (!targetInvestmentId) {
      return;
    }

    await addInvestmentValuation({
      investmentId: targetInvestmentId,
      valuedOn: valuationDate,
      currentValue: parseNumberInput(valuationCurrentValue),
      note: valuationNote || undefined,
      syncToTransaction: valuationSyncTransaction,
    });

    setValuationCurrentValue("");
    setValuationNote("");
    setInvestmentFeedback("Valuasi tersimpan. Nilai investasi dan analytics langsung diperbarui.");
  }

  const maxOverviewCategoryValue = Math.max(
    1,
    ...categoryPreview.map((item) => item.allocatedAmount ?? item.spentAmount),
  );
  const categoryPreviewTotal = categoryPreview.reduce((sum, item) => sum + item.spentAmount, 0);
  const maxReportCategoryValue = Math.max(
    1,
    ...reportCategoryPreview.map((item) => item.allocatedAmount ?? item.spentAmount),
  );
  const maxCashflowMagnitude = Math.max(
    1,
    ...cashflowPoints.map((point) => Math.max(point.income, point.expense)),
  );
  const investmentSummary = useMemo(() => getInvestmentSummary(snapshot), [snapshot]);
  const investmentByPlatform = useMemo(() => getInvestmentAllocationByPlatform(snapshot), [snapshot]);
  const investmentByInstrument = useMemo(
    () => getInvestmentAllocationByInstrument(snapshot),
    [snapshot],
  );
  const investmentByAccount = useMemo(
    () => getInvestmentDistributionByAccount(snapshot),
    [snapshot],
  );
  const investmentTrend = useMemo(() => getInvestmentTrend(snapshot), [snapshot]);
  const topGainers = useMemo(() => getInvestmentTopGainers(snapshot), [snapshot]);
  const topLosers = useMemo(() => getInvestmentTopLosers(snapshot), [snapshot]);
  const filteredInvestments = useMemo(
    () =>
      snapshot.investments.filter((item) =>
        investmentStatusFilter === "all" ? true : item.status === investmentStatusFilter,
      ),
    [investmentStatusFilter, snapshot.investments],
  );
  const categoriesByKind = useMemo(
    () => ({
      expense: snapshot.categories.filter((item) => item.kind === "expense"),
      income: snapshot.categories.filter((item) => item.kind === "income"),
    }),
    [snapshot.categories],
  );

  useEffect(() => {
    if (!quickAddNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setQuickAddNotice(null);
    }, 3200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [quickAddNotice]);

  function showQuickAddNotice(message: string, tone: QuickAddNoticeTone) {
    setQuickAddNotice({ message, tone });
  }

  return (
    <div className="space-y-6">
      {quickAddNotice ? (
        <div className="pointer-events-none fixed right-5 top-5 z-50 max-w-sm animate-[fade-in_180ms_ease-out]">
          <div
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm shadow-[0_20px_50px_rgba(18,26,32,0.18)] backdrop-blur",
              quickAddNotice.tone === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-900"
                : "border-rose-200 bg-rose-50/95 text-rose-900",
            )}
            role="status"
          >
            {quickAddNotice.message}
          </div>
        </div>
      ) : null}

      <PageHeader
        eyebrow="Core flow / finance redesign"
        title="Finance yang lebih kaya, tetap terasa operasional."
        description="Kontrol harian, pencarian transaksi, planning, laporan, dan akun dipisah supaya tiap tab punya fokus yang jelas."
      />

      <SectionCard
        description="Pilih area kerja finance sesuai kebutuhan saat ini."
        title="Finance sections"
      >
        <div className="flex flex-wrap gap-2">
          {financeTabs.map((tab) => (
            <TabButton
              active={activeTab === tab.id}
              icon={tab.icon}
              key={tab.id}
              label={tab.label}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
      </SectionCard>

      {activeTab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              detail="Gabungan rekening aktif yang bisa dipakai sekarang."
              title="Available cash"
              value={formatCurrency(overview.availableCash)}
            />
            <MetricCard
              detail={
                activeCycle
                  ? `${activeCycle.label} • ${Math.round((activeCycle.spentAmount / activeCycle.targetAmount) * 100)}% terpakai`
                  : "Belum ada cycle aktif"
              }
              title="Active cycle"
              value={
                activeCycle
                  ? `${formatCurrency(activeCycle.spentAmount)} / ${formatCurrency(activeCycle.targetAmount)}`
                  : "Belum ada"
              }
            />
            <MetricCard
              detail="Recurring plan dan debt due yang akan datang."
              title="Upcoming items"
              value={`${overview.upcomingCount} item`}
            />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <SectionCard
              className="self-start"
              description="Catat uang masuk, keluar, atau transfer tanpa pindah konteks."
              title="Quick add"
            >
              <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-6" onSubmit={handleSubmit}>
                {editingTransactionId ? (
                  <p className="md:col-span-2 xl:col-span-6 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.76)] px-4 py-3 text-sm text-[var(--foreground)]">
                    Mode edit aktif. Simpan untuk memperbarui transaksi yang sudah tercatat, atau
                    batal untuk kembali ke mode tambah.
                  </p>
                ) : null}
                <div className="min-w-0 md:col-span-2 xl:col-span-6">
                  <Field label="Judul transaksi">
                    <Input
                      onChange={(event) => setTransactionTitle(event.target.value)}
                      placeholder="Contoh: makan siang, billing client, top up"
                      required
                      value={transactionTitle}
                    />
                  </Field>
                </div>
                <div className="min-w-0 xl:col-span-2">
                  <Field label="Jenis">
                    <Select
                      onChange={(event) =>
                        setTransactionKind(
                          event.target.value as "income" | "expense" | "transfer",
                        )
                      }
                      value={transactionKind}
                    >
                      <option value="expense">Pengeluaran</option>
                      <option value="income">Pemasukan</option>
                      <option value="transfer">Transfer</option>
                    </Select>
                  </Field>
                </div>
                <div className="min-w-0 xl:col-span-2">
                  <Field label="Nominal">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-[var(--muted)]">
                        Rp
                      </span>
                      <Input
                        className="pl-11"
                        inputMode="numeric"
                        onChange={(event) =>
                          setTransactionAmount(event.target.value.replace(/\D/g, ""))
                        }
                        placeholder="0"
                        required
                        type="text"
                        value={formatNumberInput(transactionAmount)}
                      />
                    </div>
                  </Field>
                </div>
                <div className="min-w-0 xl:col-span-2">
                  <Field label="Tanggal">
                    <Input
                      onChange={(event) => setOccurredOn(event.target.value)}
                      type="date"
                      value={occurredOn}
                    />
                  </Field>
                </div>
                <div className="min-w-0 xl:col-span-2">
                  <Field label="Akun">
                    <Select onChange={(event) => setAccountId(event.target.value)} value={accountId}>
                      {snapshot.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {transactionKind === "transfer" ? (
                  <div className="min-w-0 xl:col-span-2">
                    <Field label="Akun tujuan">
                      <Select
                        onChange={(event) => setTransferTargetAccountId(event.target.value)}
                        value={transferTargetAccountId}
                      >
                        {snapshot.accounts
                          .filter((account) => account.id !== accountId)
                          .map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name}
                            </option>
                          ))}
                      </Select>
                    </Field>
                  </div>
                ) : (
                  <div className="min-w-0 xl:col-span-2">
                    <Field label="Kategori">
                      <Select onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
                        {snapshot.categories
                          .filter((category) =>
                            transactionKind === "income"
                              ? category.kind === "income"
                              : category.kind === "expense",
                          )
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </Select>
                    </Field>
                  </div>
                )}
                <div className="min-w-0 xl:col-span-2">
                  <Field label="Merchant">
                    <Input
                      onChange={(event) => setMerchant(event.target.value)}
                      placeholder="Contoh: PLN Mobile, Tuku, Client"
                      value={merchant}
                    />
                  </Field>
                </div>
                <div className="min-w-0 xl:col-span-4">
                  <Field label="Tags pencarian">
                    <Input
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="Contoh: nongkrong, kerja, utilitas"
                      value={tags}
                    />
                  </Field>
                </div>
                <div className="min-w-0 xl:col-span-2">
                  <Field label="Cycle budget">
                    <Select onChange={(event) => setCycleId(event.target.value)} value={cycleId}>
                      <option value="">Tanpa cycle</option>
                      {snapshot.budgetCycles.map((cycle) => (
                        <option key={cycle.id} value={cycle.id}>
                          {cycle.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="min-w-0 md:col-span-2 xl:col-span-6">
                  <Field label="Catatan">
                    <Textarea
                      className="min-h-24"
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Context tambahan bila perlu"
                      value={note}
                    />
                  </Field>
                </div>
                <div className="md:col-span-2 xl:col-span-6 flex items-center">
                  <div className="flex flex-wrap items-center gap-3">
                    <ActionButton type="submit">
                      {editingTransactionId ? "Update transaksi" : "Simpan transaksi"}
                    </ActionButton>
                    {editingTransactionId ? (
                      <ActionButton
                        onClick={resetTransactionForm}
                        type="button"
                        variant="ghost"
                      >
                        Batal edit
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
                {transactionFeedback ? (
                  <p className="md:col-span-2 xl:col-span-6 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                    {transactionFeedback}
                  </p>
                ) : null}
              </form>
            </SectionCard>

            <div className="space-y-6">
              <SectionCard
                description="Yang paling layak diperiksa hari ini."
                title="Today alerts"
              >
                <div className="space-y-3">
                  {upcomingItems.slice(0, 4).map((item) => (
                    <div
                      className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
                      key={item.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{item.label}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {formatDate(item.dueOn)} • {item.detail}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(item.amount)}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{item.type}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>

          <SectionCard
            description="Satu insight utama untuk membaca pengeluaran yang paling dominan."
            title="Pengeluaran utama"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <PreviewToggle
                  active={overviewCategoryScope === "cycle"}
                  label="Siklus aktif"
                  onClick={() => setOverviewCategoryScope("cycle")}
                />
                <PreviewToggle
                  active={overviewCategoryScope === "month"}
                  label="Bulan"
                  onClick={() => setOverviewCategoryScope("month")}
                />
                {overviewCategoryScope === "month" ? (
                  <div className="min-w-36">
                    <Select
                      onChange={(event) => setReportMonth(event.target.value)}
                      value={reportMonth}
                    >
                      {availableMonths.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
              </div>

              {categoryPreview.length === 0 ? (
                <EmptyState
                  description="Belum ada pengeluaran yang bisa dibaca untuk scope ini."
                  title="Belum ada data pengeluaran"
                />
              ) : (
                <div className="space-y-3">
                  {categoryPreview.map((item) => {
                    const remainingAmount = (item.allocatedAmount ?? 0) - item.spentAmount;
                    const isOverspent =
                      typeof item.allocatedAmount === "number" &&
                      item.spentAmount > item.allocatedAmount;

                    return (
                      <ValueBar
                        helper={
                          typeof item.allocatedAmount === "number"
                            ? isOverspent
                              ? `Overspent ${formatCurrency(Math.abs(remainingAmount))}`
                              : `Sisa ${formatCurrency(remainingAmount)}`
                            : `${Math.round(
                                (item.spentAmount / Math.max(1, categoryPreviewTotal)) * 100,
                              )}% dari total spend`
                        }
                        key={item.categoryId}
                        label={item.label}
                        tone={isOverspent ? "amber" : "mint"}
                        value={
                          typeof item.allocatedAmount === "number"
                            ? `${formatCurrency(item.spentAmount)} / ${formatCurrency(item.allocatedAmount)}`
                            : formatCurrency(item.spentAmount)
                        }
                        width={
                          typeof item.allocatedAmount === "number"
                            ? (item.spentAmount / Math.max(1, item.allocatedAmount)) * 100
                            : (item.spentAmount / maxOverviewCategoryValue) * 100
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "transactions" ? (
        <div className="space-y-6">
          <SectionCard
            description="Filter inti tampil dulu, sisanya dibuka saat memang perlu."
            title="Transaction filters"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Search">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--muted)]">
                    <Search className="size-4" strokeWidth={2.2} />
                  </span>
                  <Input
                    className="pl-11"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari judul, merchant, tag, catatan"
                    value={search}
                  />
                </div>
              </Field>
              <Field label="Kind">
                <Select onChange={(event) => setFilterKind(event.target.value)} value={filterKind}>
                  <option value="all">Semua</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                </Select>
              </Field>
              <Field label="Akun">
                <Select
                  onChange={(event) => setFilterAccountId(event.target.value)}
                  value={filterAccountId}
                >
                  <option value="all">Semua akun</option>
                  {snapshot.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kategori">
                <Select
                  onChange={(event) => setFilterCategoryId(event.target.value)}
                  value={filterCategoryId}
                >
                  <option value="all">Semua kategori</option>
                  {snapshot.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                </Select>
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ActionButton
                onClick={() => setShowAdvancedFilters((current) => !current)}
                variant="ghost"
              >
                {showAdvancedFilters ? "Sembunyikan filter lanjutan" : "Tampilkan filter lanjutan"}
              </ActionButton>
            </div>
            {showAdvancedFilters ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Merchant">
                  <Select
                    onChange={(event) => setFilterMerchant(event.target.value)}
                    value={filterMerchant}
                  >
                    <option value="all">Semua merchant</option>
                    {availableMerchants.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tag">
                  <Select onChange={(event) => setFilterTag(event.target.value)} value={filterTag}>
                    <option value="all">Semua tag</option>
                    {availableTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Month">
                  <Select
                    onChange={(event) => setFilterMonth(event.target.value)}
                    value={filterMonth}
                  >
                    <option value="all">Semua bulan</option>
                    {availableMonths.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tanggal spesifik">
                  <Input
                    onChange={(event) => setFilterDate(event.target.value)}
                    type="date"
                    value={filterDate}
                  />
                </Field>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            description="Ledger transaksi sekarang diberi ruang penuh supaya review arus uang, merchant, tag, category, account, dan note terasa lebih lega."
            title={`Filtered transactions (${filteredTransactions.length})`}
          >
            <div className="space-y-3">
              {filteredTransactions.length === 0 ? (
                <EmptyState
                  description="Coba longgarkan kombinasi filter atau cari dengan merchant/tag yang berbeda."
                  title="Tidak ada transaksi yang cocok"
                />
              ) : null}
              {filteredTransactions.map((transaction) => {
                const account = resolveAccountName(snapshot.accounts, transaction.accountId);
                const category = snapshot.categories.find((item) => item.id === transaction.categoryId);

                return (
                  <div
                    className="rounded-[24px] border border-[var(--border)] bg-white/82 px-5 py-4"
                    key={transaction.id}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 md:max-w-[78%]">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{transaction.title}</p>
                          <Pill
                            tone={
                              transaction.kind === "income"
                                ? "mint"
                                : transaction.kind === "expense"
                                  ? "amber"
                                  : "neutral"
                            }
                          >
                            {transaction.kind}
                          </Pill>
                          {transaction.sourceType ? (
                            <Pill>{transactionSourceLabel(transaction.sourceType)}</Pill>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          {formatDate(transaction.occurredOn)} • {account}
                          {category ? ` • ${category.name}` : ""}
                          {transaction.merchant ? ` • ${transaction.merchant}` : ""}
                        </p>
                        {(transaction.tags ?? []).length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(transaction.tags ?? []).map((tag) => (
                              <Pill key={`${transaction.id}-${tag}`}>{tag}</Pill>
                            ))}
                          </div>
                        ) : null}
                        {transaction.note ? (
                          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                            {transaction.note}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-left md:min-w-[172px] md:text-right">
                        <p className="text-lg font-semibold">{formatCurrency(transaction.amount)}</p>
                        {transaction.transferTargetAccountId ? (
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            ke{" "}
                            {resolveAccountName(
                              snapshot.accounts,
                              transaction.transferTargetAccountId,
                            )}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2 md:justify-end">
                          {transaction.sourceType && isTransactionSourceStillAvailable(snapshot, transaction) ? (
                            <p className="text-xs text-[var(--muted)]">
                              Kelola transaksi ini dari modul sumber.
                            </p>
                          ) : (
                            <>
                              {!transaction.sourceType ? (
                                <ActionButton
                                  onClick={() => startEditTransaction(transaction.id)}
                                  variant="ghost"
                                >
                                  Edit
                                </ActionButton>
                              ) : null}
                              <ActionButton
                                onClick={() => void handleDeleteTransaction(transaction.id)}
                                variant="ghost"
                              >
                                Hapus
                              </ActionButton>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "planning" ? (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <SectionCard
              description="Form dibuka saat memang ingin menambah recurring."
              title="Recurring"
            >
              {showRecurringForm ? (
                <form className="grid gap-4 md:grid-cols-2" onSubmit={handleRecurringSubmit}>
                  <Field label="Label">
                    <Input
                      onChange={(event) => setRecurringLabel(event.target.value)}
                      placeholder="Contoh: internet kos, uang jajan 5 harian"
                      required
                      value={recurringLabel}
                    />
                  </Field>
                  <Field label="Kind">
                    <Select
                      onChange={(event) =>
                        setRecurringKind(event.target.value as "income" | "expense")
                      }
                      value={recurringKind}
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </Select>
                  </Field>
                  <Field label="Amount">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-[var(--muted)]">
                        Rp
                      </span>
                      <Input
                        className="pl-11"
                        inputMode="numeric"
                        onChange={(event) =>
                          setRecurringAmount(event.target.value.replace(/\D/g, ""))
                        }
                        placeholder="0"
                        required
                        type="text"
                        value={formatNumberInput(recurringAmount)}
                      />
                    </div>
                  </Field>
                  <Field label="Cadence">
                    <Select
                      onChange={(event) =>
                        setRecurringCadence(
                          event.target.value as "weekly" | "monthly" | "custom",
                        )
                      }
                      value={recurringCadence}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom</option>
                    </Select>
                  </Field>
                  <Field label="Next occurrence">
                    <Input
                      onChange={(event) => setRecurringDate(event.target.value)}
                      type="date"
                      value={recurringDate}
                    />
                  </Field>
                  <Field label="Account">
                    <Select
                      onChange={(event) => setRecurringAccountId(event.target.value)}
                      value={recurringAccountId}
                    >
                      {snapshot.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Category">
                    <Select
                      onChange={(event) => setRecurringCategoryId(event.target.value)}
                      value={recurringCategoryId}
                    >
                      <option value="">Tanpa category</option>
                      {snapshot.categories
                        .filter((category) =>
                          recurringKind === "income"
                            ? category.kind === "income"
                            : category.kind === "expense",
                        )
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Field label="Merchant">
                    <Input
                      onChange={(event) => setRecurringMerchant(event.target.value)}
                      value={recurringMerchant}
                    />
                  </Field>
                  <Field label="Tags">
                    <Input
                      onChange={(event) => setRecurringTags(event.target.value)}
                      placeholder="Pisahkan dengan koma"
                      value={recurringTags}
                    />
                  </Field>
                  <div className="md:col-span-2 flex flex-wrap gap-3">
                    <ActionButton type="submit">Tambah recurring</ActionButton>
                    <ActionButton
                      onClick={() => setShowRecurringForm(false)}
                      type="button"
                      variant="ghost"
                    >
                      Tutup form
                    </ActionButton>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-[var(--muted)]">
                    Recurring dipisah dari permukaan utama supaya planning tetap terasa ringan.
                  </p>
                  <ActionButton onClick={() => setShowRecurringForm(true)} variant="secondary">
                    Tambah recurring plan
                  </ActionButton>
                </div>
              )}
            </SectionCard>

            <SectionCard
              description="Jadwal uang yang akan bergerak dalam waktu dekat."
              title="Upcoming schedule + forecast"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Upcoming finance items</p>
                  {upcomingItems.map((item) => (
                    <div
                      className="rounded-[20px] border border-[var(--border)] bg-white/80 p-4"
                      key={item.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.label}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {formatDate(item.dueOn)} • {item.detail}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(item.amount)}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{item.type}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Cash forecast</p>
                  {forecastItems.map((item) => (
                    <div
                      className="rounded-[20px] bg-[var(--surface)] p-4"
                      key={`${item.id}-forecast`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.label}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {formatDate(item.dueOn)} • {item.source}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(item.projectedBalance)}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            setelah {formatCurrency(item.amount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              description="Recurring income dan expense dipisah agar lebih cepat discan."
              title="Recurring library"
            >
              <div className="grid gap-4 md:grid-cols-2">
                {["income", "expense"].map((kind) => (
                  <div
                    className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
                    key={kind}
                  >
                    <p className="text-sm font-semibold capitalize">{kind}</p>
                    <div className="mt-3 space-y-3">
                      {snapshot.recurringPlans
                        .filter((plan) => plan.kind === kind)
                        .map((plan) => (
                          <div
                            className="rounded-[18px] bg-[var(--surface)] px-4 py-3"
                            key={plan.id}
                          >
                            <p className="font-medium">{plan.label}</p>
                            <p className="mt-1 text-sm text-[var(--muted)]">
                              {formatCurrency(plan.amount)} • {plan.cadence} •{" "}
                              {formatDate(plan.nextOccurrenceOn)}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              description="Cicilan tetap dipantulkan ke finance agar cashflow terasa utuh."
              title="Debt-linked planning"
            >
              <div className="space-y-3">
                {getOpenInstallments(snapshot)
                  .slice(0, 6)
                  .map((installment) => {
                    const debt = snapshot.debts.find((item) => item.id === installment.debtId);

                    if (!debt) {
                      return null;
                    }

                    return (
                    <div
                      className="rounded-[22px] border border-[var(--border)] bg-white/82 p-4"
                      key={installment.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {debt.name} • cicilan {installment.installmentNumber}
                          </p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {debt.lender} • due {formatDate(installment.dueOn)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatCurrency(getInstallmentPaymentAmount(installment))}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            sisa {debt.remainingMonths} / {debt.totalMonths}
                          </p>
                        </div>
                      </div>
                    </div>
                    );
                  })}
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}

      {activeTab === "reports" ? (
        <div className="space-y-6">
          <SectionCard
            description="Laporan diprioritaskan ke dua hal: uang habis di mana dan bagaimana ritme cashflow bergerak."
            title="Report controls"
          >
            <div className="flex flex-wrap gap-3">
              <TabButton
                active={reportScope === "cycle"}
                icon={Repeat2}
                label="Active cycle"
                onClick={() => setReportScope("cycle")}
              />
              <TabButton
                active={reportScope === "month"}
                icon={CalendarRange}
                label="Current month"
                onClick={() => setReportScope("month")}
              />
              <div className="min-w-44">
                <Select onChange={(event) => setReportMonth(event.target.value)} value={reportMonth}>
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <SectionCard
              description="Category spending adalah insight utama untuk menjawab: uang paling banyak keluar ke mana?"
              title="Category spending"
            >
              <div className="space-y-3">
                {reportCategoryPreview.map((item) => (
                  <ValueBar
                    helper={
                      item.allocatedAmount
                        ? `Budget ${formatCurrency(item.allocatedAmount)}`
                        : "Tanpa budget category"
                    }
                    key={item.categoryId}
                    label={item.label}
                    tone="amber"
                    value={formatCurrency(item.spentAmount)}
                    width={
                      ((item.allocatedAmount ?? item.spentAmount) / maxReportCategoryValue) * 100
                    }
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard
              description="Cashflow trend menampilkan ritme income dan expense per hari di bulan terpilih."
              title="Cashflow trend"
            >
              <div className="space-y-3">
                {cashflowPoints.map((point) => (
                  <div
                    className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
                    key={point.id}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-medium">{point.label}</p>
                      <p className="text-sm font-semibold">{formatCurrency(point.net)}</p>
                    </div>
                    <div className="grid gap-2">
                      <ValueBar
                        label="Income"
                        tone="mint"
                        value={formatCurrency(point.income)}
                        width={(point.income / maxCashflowMagnitude) * 100}
                      />
                      <ValueBar
                        label="Expense"
                        tone="amber"
                        value={formatCurrency(point.expense)}
                        width={(point.expense / maxCashflowMagnitude) * 100}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}

      {activeTab === "investments" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              detail="Total modal yang sudah ditempatkan ke investasi aktif."
              title="Total invested"
              value={formatCurrency(investmentSummary.investedAmount)}
            />
            <MetricCard
              detail="Nilai terbaru berdasarkan update valuasi per instrumen."
              title="Current value"
              value={formatCurrency(investmentSummary.currentValue)}
            />
            <MetricCard
              detail={`${investmentSummary.gainLossPercent.toFixed(2)}% terhadap modal`} 
              title="Unrealized gain/loss"
              value={formatCurrency(investmentSummary.gainLoss)}
            />
            <MetricCard
              detail="Jumlah instrumen yang masih berjalan."
              title="Active positions"
              value={`${investmentSummary.activeCount} item`}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              description="Tambah investasi baru. Opsi catat modal awal akan tersimpan sebagai transfer dari akun pembayaran ke akun investasi otomatis."
              title="Tambah investasi"
            >
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleAddInvestment}>
                <Field label="Nama investasi">
                  <Input
                    onChange={(event) => setInvestmentName(event.target.value)}
                    placeholder="Contoh: BBCA, BTC, RDPU"
                    required
                    value={investmentName}
                  />
                </Field>
                <Field label="Platform">
                  <Input
                    onChange={(event) => setInvestmentPlatform(event.target.value)}
                    placeholder="Contoh: Bibit, Stockbit"
                    required
                    value={investmentPlatform}
                  />
                </Field>
                <Field label="Instrumen">
                  <Select
                    onChange={(event) =>
                      setInvestmentInstrument(
                        event.target.value as
                          | "stock"
                          | "fund"
                          | "bond"
                          | "crypto"
                          | "gold"
                          | "money-market"
                          | "other",
                      )
                    }
                    value={investmentInstrument}
                  >
                    <option value="stock">Stock</option>
                    <option value="fund">Fund</option>
                    <option value="bond">Bond</option>
                    <option value="crypto">Crypto</option>
                    <option value="gold">Gold</option>
                    <option value="money-market">Money market</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
                {editingInvestmentId ? (
                  <Field label="Status">
                    <Select
                      onChange={(event) =>
                        setInvestmentStatus(event.target.value as "active" | "paused" | "closed")
                      }
                      value={investmentStatus}
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="closed">Closed</option>
                    </Select>
                  </Field>
                ) : null}
                <Field label="Tanggal mulai">
                  <Input
                    onChange={(event) => setInvestmentStartDate(event.target.value)}
                    type="date"
                    value={investmentStartDate}
                  />
                </Field>
                <Field label="Modal awal">
                  <Input
                    inputMode="numeric"
                    onChange={(event) =>
                      setInvestmentInvestedAmount(event.target.value.replace(/\D/g, ""))
                    }
                    required
                    type="text"
                    value={formatNumberInput(investmentInvestedAmount)}
                  />
                </Field>
                <Field label="Nilai saat ini">
                  <Input
                    inputMode="numeric"
                    onChange={(event) =>
                      setInvestmentCurrentValue(event.target.value.replace(/\D/g, ""))
                    }
                    required
                    type="text"
                    value={formatNumberInput(investmentCurrentValue)}
                  />
                </Field>
                <Field label="Akun pembayaran modal">
                  <Select
                    onChange={(event) => setInvestmentAccountId(event.target.value)}
                    value={investmentAccountId}
                  >
                    {snapshot.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tags (opsional)">
                  <Input
                    onChange={(event) => setInvestmentTags(event.target.value)}
                    placeholder="Contoh: jangka-panjang, dividen"
                    value={investmentTags}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Catatan">
                    <Textarea
                      onChange={(event) => setInvestmentNote(event.target.value)}
                      placeholder="Catatan strategi, alasan entry, target"
                      value={investmentNote}
                    />
                  </Field>
                </div>
                <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-[var(--muted)]">
                  <input
                    checked={investmentSyncTransaction}
                    onChange={(event) => setInvestmentSyncTransaction(event.target.checked)}
                    disabled={Boolean(editingInvestmentId)}
                    type="checkbox"
                  />
                  Catat modal awal sebagai transaksi transfer ke akun investasi
                </label>
                <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                  <ActionButton type="submit">
                    {editingInvestmentId ? "Update investasi" : "Simpan investasi"}
                  </ActionButton>
                  {editingInvestmentId ? (
                    <ActionButton onClick={cancelEditInvestment} type="button" variant="ghost">
                      Batal edit
                    </ActionButton>
                  ) : null}
                </div>
              </form>
            </SectionCard>

            <SectionCard
              description="Masukkan valuasi baru per tanggal. Opsional sinkron jadi transaksi income/expense berdasarkan delta."
              title="Update valuasi"
            >
              <form className="grid gap-4" data-testid="investment-valuation-form" onSubmit={handleAddValuation}>
                <Field label="Investasi">
                  <Select
                    data-testid="investment-valuation-select"
                    onChange={(event) => setValuationInvestmentId(event.target.value)}
                    value={valuationInvestmentId || snapshot.investments[0]?.id || ""}
                  >
                    {snapshot.investments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} • {item.platform}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tanggal valuasi">
                  <Input
                    onChange={(event) => setValuationDate(event.target.value)}
                    type="date"
                    value={valuationDate}
                  />
                </Field>
                <Field label="Nilai saat ini">
                  <Input
                    data-testid="investment-valuation-current-value"
                    inputMode="numeric"
                    onChange={(event) => setValuationCurrentValue(event.target.value.replace(/\D/g, ""))}
                    required
                    type="text"
                    value={formatNumberInput(valuationCurrentValue)}
                  />
                </Field>
                <Field label="Catatan">
                  <Textarea
                    data-testid="investment-valuation-note"
                    onChange={(event) => setValuationNote(event.target.value)}
                    placeholder="Contoh: penyesuaian mark-to-market"
                    value={valuationNote}
                  />
                </Field>
                <label className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
                  <input
                    checked={valuationSyncTransaction}
                    onChange={(event) => setValuationSyncTransaction(event.target.checked)}
                    type="checkbox"
                  />
                  Sinkron delta valuasi ke transaksi finance
                </label>
                <ActionButton disabled={snapshot.investments.length === 0} type="submit">
                  Simpan valuasi
                </ActionButton>
              </form>
            </SectionCard>
          </div>

          {investmentFeedback ? (
            <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
              {investmentFeedback}
            </p>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard description="Bobot nilai investasi berdasarkan platform." title="Alokasi platform">
              <div className="space-y-3">
                {investmentByPlatform.map((row) => (
                  <ValueBar
                    key={row.platform}
                    label={row.platform}
                    tone="ink"
                    value={formatCurrency(row.value)}
                    width={(row.value / Math.max(1, investmentSummary.currentValue)) * 100}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard description="Sebaran nilai per jenis instrumen." title="Alokasi instrumen">
              <div className="space-y-3">
                {investmentByInstrument.map((row) => (
                  <ValueBar
                    key={row.instrument}
                    label={row.instrument}
                    tone="mint"
                    value={formatCurrency(row.value)}
                    width={(row.value / Math.max(1, investmentSummary.currentValue)) * 100}
                  />
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <SectionCard description="Tren total nilai portofolio dari histori valuasi." title="Portfolio trend">
              <div className="space-y-3">
                {investmentTrend.map((point) => (
                  <ValueBar
                    key={point.id}
                    label={point.label}
                    tone="ink"
                    value={formatCurrency(point.value)}
                    width={(point.value / Math.max(1, investmentSummary.currentValue)) * 100}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard description="Posisi dengan gain tertinggi saat ini." title="Top gainers">
              <div className="space-y-3">
                {topGainers.map((item) => (
                  <div className="rounded-[20px] bg-[var(--surface)] p-4" key={item.id}>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-[var(--muted)]">{item.gainLossPercent.toFixed(2)}%</p>
                    <p className="mt-2 font-semibold text-emerald-700">{formatCurrency(item.gainLoss)}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard description="Posisi dengan performa terlemah agar mudah dipantau." title="Top losers">
              <div className="space-y-3">
                {topLosers.map((item) => (
                  <div className="rounded-[20px] bg-[var(--surface)] p-4" key={item.id}>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-[var(--muted)]">{item.gainLossPercent.toFixed(2)}%</p>
                    <p className="mt-2 font-semibold text-rose-700">{formatCurrency(item.gainLoss)}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard description="Distribusi nilai investasi berdasarkan akun finance." title="Distribusi per akun">
            <div className="space-y-3">
              {investmentByAccount.map((row) => (
                <ValueBar
                  key={row.accountId}
                  label={row.accountName}
                  tone="amber"
                  value={formatCurrency(row.value)}
                  width={(row.value / Math.max(1, investmentSummary.currentValue)) * 100}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard description="Portofolio list-first untuk review dan tindakan cepat." title="Daftar investasi">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="min-w-44">
                <Select
                  onChange={(event) =>
                    setInvestmentStatusFilter(
                      event.target.value as "all" | "active" | "paused" | "closed",
                    )
                  }
                  value={investmentStatusFilter}
                >
                  <option value="all">Semua status</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="closed">Closed</option>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              {filteredInvestments.map((item) => {
                const gainLoss = item.currentValue - item.investedAmount;

                return (
                  <div
                    className="rounded-[24px] border border-[var(--border)] bg-white/82 px-5 py-4"
                    data-testid={`investment-row-${item.id}`}
                    key={item.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{item.name}</p>
                          <Pill>{item.instrument}</Pill>
                          <Pill>{item.status}</Pill>
                        </div>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {item.platform} • sejak {formatDate(item.startDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ActionButton onClick={() => startEditInvestment(item.id)} variant="ghost">
                          Edit
                        </ActionButton>
                        <ActionButton onClick={() => void deleteInvestment(item.id)} variant="ghost">
                          Hapus
                        </ActionButton>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <ValueBar
                        label="Modal"
                        tone="ink"
                        value={formatCurrency(item.investedAmount)}
                        width={100}
                      />
                      <ValueBar
                        label="Nilai sekarang"
                        tone="mint"
                        value={formatCurrency(item.currentValue)}
                        width={
                          (item.currentValue / Math.max(item.currentValue, item.investedAmount, 1)) * 100
                        }
                      />
                      <ValueBar
                        helper={`${((gainLoss / Math.max(1, item.investedAmount)) * 100).toFixed(2)}%`}
                        label="Gain/Loss"
                        tone={gainLoss >= 0 ? "mint" : "amber"}
                        value={formatCurrency(gainLoss)}
                        width={(Math.abs(gainLoss) / Math.max(1, item.currentValue)) * 100}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "accounts" ? (
        <div className="space-y-6">
          <SectionCard
            description="Area setup finance dipisah per kelompok supaya akun, kategori, dan cycle tidak lagi bercampur dalam satu form panjang."
            title="Finance setup"
          >
            <div className="mb-5 grid gap-4 md:grid-cols-3">
              <MetricCard
                detail="Kas, bank, dan e-wallet yang aktif di finance."
                title="Accounts"
                value={`${snapshot.accounts.length} akun`}
              />
              <MetricCard
                detail="Gabungan kategori income dan expense untuk klasifikasi transaksi."
                title="Categories"
                value={`${snapshot.categories.length} kategori`}
              />
              <MetricCard
                detail={
                  activeCycle
                    ? `Aktif sekarang: ${activeCycle.label}`
                    : "Belum ada cycle aktif saat ini."
                }
                title="Budget cycles"
                value={`${snapshot.budgetCycles.length} cycle`}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-3">
                {financeSettingsSections.map((section) => {
                  const Icon = section.icon;

                  return (
                    <button
                      className={cn(
                        "w-full rounded-[24px] border px-4 py-4 text-left transition-colors",
                        activeSettingsSection === section.id
                          ? "border-[var(--border-strong)] bg-white text-[var(--foreground)] shadow-[var(--shadow-sm)]"
                          : "border-[var(--border)] bg-[rgba(255,255,255,0.72)] text-[var(--muted)] hover:bg-white",
                      )}
                      key={section.id}
                      onClick={() => setActiveSettingsSection(section.id)}
                      type="button"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-[var(--surface)] p-2">
                          <Icon className="size-4" strokeWidth={2.2} />
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">{section.label}</p>
                          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                            {section.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-6">
                {activeSettingsSection === "accounts" ? (
                  <>
                    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                      <form
                        className="space-y-4 rounded-[24px] border border-[var(--border)] bg-white/82 p-5"
                        onSubmit={handleAddAccount}
                      >
                        <div className="space-y-1">
                          <p className="font-semibold">
                            {editingAccountId ? "Edit akun" : "Tambah akun baru"}
                          </p>
                          <p className="text-sm leading-6 text-[var(--muted)]">
                            {editingAccountId
                              ? "Perbarui nama, tipe, atau saldo akun yang sudah ada."
                              : "Cocok untuk rekening, cash, atau e-wallet baru."}
                          </p>
                        </div>
                        <Field label="Nama akun">
                          <Input
                            onChange={(event) => setAccountName(event.target.value)}
                            placeholder="Contoh: Jago Operasional"
                            required
                            value={accountName}
                          />
                        </Field>
                        <Field label="Tipe akun">
                          <Select
                            onChange={(event) =>
                              setAccountType(event.target.value as "cash" | "bank" | "e-wallet")
                            }
                            value={accountType}
                          >
                            <option value="bank">Bank</option>
                            <option value="cash">Cash</option>
                            <option value="e-wallet">E-wallet</option>
                          </Select>
                        </Field>
                        <Field label="Saldo awal">
                          <div className="relative">
                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-[var(--muted)]">
                              Rp
                            </span>
                            <Input
                              className="pl-11"
                              inputMode="numeric"
                              onChange={(event) =>
                                setAccountBalance(event.target.value.replace(/\D/g, ""))
                              }
                              placeholder="0"
                              type="text"
                              value={formatNumberInput(accountBalance)}
                            />
                          </div>
                        </Field>
                        <div className="flex flex-wrap items-center gap-3">
                          <ActionButton type="submit">
                            {editingAccountId ? "Update akun" : "Tambah akun"}
                          </ActionButton>
                          {editingAccountId ? (
                            <ActionButton onClick={resetAccountForm} type="button" variant="ghost">
                              Batal edit
                            </ActionButton>
                          ) : null}
                        </div>
                        {accountFeedback ? (
                          <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                            {accountFeedback}
                          </p>
                        ) : null}
                      </form>

                      <div className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                          {snapshot.accounts.map((account) => {
                            const share = overview.availableCash
                              ? (account.balance / overview.availableCash) * 100
                              : 0;

                            return (
                              <div
                                className="rounded-[24px] border border-[var(--border)] bg-white/82 p-5"
                                key={account.id}
                              >
                                <p className="font-semibold">{account.name}</p>
                                <p className="mt-1 text-sm text-[var(--muted)]">{account.type}</p>
                                <p className="mt-4 text-2xl font-semibold">
                                  {formatCurrency(account.balance)}
                                </p>
                                <div className="mt-4 h-3 rounded-full bg-[rgba(16,33,43,0.08)]">
                                  <div
                                    className="h-3 rounded-full bg-[linear-gradient(90deg,#7dd3fc,#0f766e)]"
                                    style={{ width: `${Math.max(8, Math.min(100, share))}%` }}
                                  />
                                </div>
                                <p className="mt-2 text-sm text-[var(--muted)]">
                                  {share.toFixed(1)}% dari total available cash
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <ActionButton
                                    onClick={() => startEditAccount(account.id)}
                                    variant="ghost"
                                  >
                                    Edit akun
                                  </ActionButton>
                                  <ActionButton
                                    onClick={() => void handleDeleteAccount(account.id)}
                                    variant="ghost"
                                  >
                                    Hapus akun
                                  </ActionButton>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {snapshot.accounts.map((account) => (
                            <div
                              className="rounded-[24px] border border-[var(--border)] bg-white/80 p-4"
                              key={`${account.id}-activity`}
                            >
                              <p className="text-sm font-semibold">{account.name}</p>
                              <div className="mt-3 space-y-3">
                                {getAccountMovement(snapshot, account.id).map((transaction) => (
                                  <div
                                    className="rounded-[18px] bg-[var(--surface)] px-4 py-3"
                                    key={`${account.id}-${transaction.id}`}
                                  >
                                    <p className="font-medium">{transaction.title}</p>
                                    <p className="mt-1 text-xs text-[var(--muted)]">
                                      {formatDate(transaction.occurredOn)}
                                      {transaction.merchant ? ` • ${transaction.merchant}` : ""}
                                    </p>
                                    <p className="mt-2 text-sm font-semibold">
                                      {formatCurrency(transaction.amount)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                {activeSettingsSection === "categories" ? (
                  <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
                    <form
                      className="space-y-4 rounded-[24px] border border-[var(--border)] bg-white/82 p-5"
                      onSubmit={handleAddCategory}
                    >
                      <div className="space-y-1">
                        <p className="font-semibold">Tambah kategori baru</p>
                        <p className="text-sm leading-6 text-[var(--muted)]">
                          Kategori baru langsung tersedia di transaksi dan recurring.
                        </p>
                      </div>
                      <Field label="Nama kategori">
                        <Input
                          onChange={(event) => setCategoryName(event.target.value)}
                          placeholder="Contoh: Kesehatan"
                          required
                          value={categoryName}
                        />
                      </Field>
                      <Field label="Jenis kategori">
                        <Select
                          onChange={(event) =>
                            setCategoryKind(event.target.value as "income" | "expense")
                          }
                          value={categoryKind}
                        >
                          <option value="expense">Pengeluaran</option>
                          <option value="income">Pemasukan</option>
                        </Select>
                      </Field>
                      <ActionButton type="submit">Tambah kategori</ActionButton>
                      {categoryFeedback ? (
                        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                          {categoryFeedback}
                        </p>
                      ) : null}
                    </form>

                    <div className="grid gap-4 md:grid-cols-2">
                      {(["expense", "income"] as const).map((kind) => (
                        <div
                          className="rounded-[24px] border border-[var(--border)] bg-white/82 p-5"
                          key={kind}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold">
                                {kind === "expense" ? "Kategori expense" : "Kategori income"}
                              </p>
                              <p className="mt-1 text-sm text-[var(--muted)]">
                                {categoriesByKind[kind].length} kategori aktif
                              </p>
                            </div>
                            <Pill tone={kind === "expense" ? "amber" : "mint"}>{kind}</Pill>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {categoriesByKind[kind].map((category) => (
                              <Pill key={category.id}>{category.name}</Pill>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeSettingsSection === "cycles" ? (
                  <div className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
                    <form
                      className="space-y-4 rounded-[24px] border border-[var(--border)] bg-white/82 p-5"
                      onSubmit={handleAddBudgetCycle}
                    >
                      <div className="space-y-1">
                        <p className="font-semibold">
                          {editingCycleId ? "Edit budget cycle" : "Tambah budget cycle baru"}
                        </p>
                        <p className="text-sm leading-6 text-[var(--muted)]">
                          Saat membuat atau mengubah cycle menjadi aktif, cycle aktif lain akan
                          otomatis selesai.
                        </p>
                      </div>
                      <Field label="Label cycle">
                        <Input
                          onChange={(event) => setCycleLabelInput(event.target.value)}
                          placeholder="Contoh: Siklus 1-7 April"
                          required
                          value={cycleLabelInput}
                        />
                      </Field>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Mulai">
                          <Input
                            onChange={(event) => setCycleStartOnInput(event.target.value)}
                            required
                            type="date"
                            value={cycleStartOnInput}
                          />
                        </Field>
                        <Field label="Selesai">
                          <Input
                            onChange={(event) => setCycleEndOnInput(event.target.value)}
                            required
                            type="date"
                            value={cycleEndOnInput}
                          />
                        </Field>
                      </div>
                      <Field label="Target budget">
                        <div className="relative">
                          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-[var(--muted)]">
                            Rp
                          </span>
                          <Input
                            className="pl-11"
                            inputMode="numeric"
                            onChange={(event) =>
                              setCycleTargetAmountInput(event.target.value.replace(/\D/g, ""))
                            }
                            placeholder="0"
                            type="text"
                            value={formatNumberInput(cycleTargetAmountInput)}
                          />
                        </div>
                      </Field>
                      <Field label="Status">
                        <Select
                          onChange={(event) =>
                            setCycleStatusInput(
                              event.target.value as "active" | "planned" | "completed",
                            )
                          }
                          value={cycleStatusInput}
                        >
                          <option value="active">Active</option>
                          <option value="planned">Planned</option>
                          <option value="completed">Completed</option>
                        </Select>
                      </Field>
                      <div className="flex flex-wrap items-center gap-3">
                        <ActionButton type="submit">
                          {editingCycleId ? "Update cycle" : "Tambah cycle"}
                        </ActionButton>
                        {editingCycleId ? (
                          <ActionButton
                            onClick={resetCycleForm}
                            type="button"
                            variant="ghost"
                          >
                            Batal edit
                          </ActionButton>
                        ) : null}
                      </div>
                      {cycleFeedback ? (
                        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                          {cycleFeedback}
                        </p>
                      ) : null}
                    </form>

                    <div className="space-y-4">
                      {snapshot.budgetCycles.map((cycle) => {
                        const spendRatio = cycle.targetAmount
                          ? (cycle.spentAmount / cycle.targetAmount) * 100
                          : 0;

                        return (
                          <div
                            className="rounded-[24px] border border-[var(--border)] bg-white/82 p-5"
                            key={cycle.id}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold">{cycle.label}</p>
                                  <Pill
                                    tone={
                                      cycle.status === "active"
                                        ? "mint"
                                        : cycle.status === "planned"
                                          ? "neutral"
                                          : "amber"
                                    }
                                  >
                                    {cycle.status}
                                  </Pill>
                                </div>
                                <p className="mt-1 text-sm text-[var(--muted)]">
                                  {formatDate(cycle.startOn)} - {formatDate(cycle.endOn)}
                                </p>
                              </div>
                              <ActionButton
                                onClick={() => startEditCycle(cycle.id)}
                                variant="ghost"
                              >
                                <PencilLine className="mr-2 size-4" strokeWidth={2.2} />
                                Edit
                              </ActionButton>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                              <ValueBar
                                label="Target"
                                tone="ink"
                                value={formatCurrency(cycle.targetAmount)}
                                width={100}
                              />
                              <ValueBar
                                label="Spent"
                                tone={cycle.spentAmount > cycle.targetAmount ? "amber" : "mint"}
                                value={formatCurrency(cycle.spentAmount)}
                                width={Math.max(8, Math.min(100, spendRatio || 8))}
                              />
                              <ValueBar
                                label="Income"
                                tone="mint"
                                value={formatCurrency(cycle.incomeAmount)}
                                width={
                                  cycle.targetAmount
                                    ? (cycle.incomeAmount / cycle.targetAmount) * 100
                                    : 8
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}

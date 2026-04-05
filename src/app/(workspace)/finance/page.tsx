"use client";

import { useDeferredValue, useMemo, useState, type FormEvent } from "react";
import {
  CalendarRange,
  ChartColumn,
  Landmark,
  Repeat2,
  Search,
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

type FinanceTab = "overview" | "transactions" | "planning" | "reports" | "accounts";
type PreviewScope = "cycle" | "month";

const financeTabs: Array<{ id: FinanceTab; label: string; icon: typeof WalletCards }> = [
  { id: "overview", label: "Overview", icon: WalletCards },
  { id: "transactions", label: "Transactions", icon: Search },
  { id: "planning", label: "Planning", icon: CalendarRange },
  { id: "reports", label: "Reports", icon: ChartColumn },
  { id: "accounts", label: "Accounts", icon: Landmark },
];

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
    addBudgetCycle,
    addCategory,
    addRecurringPlan,
    addTransaction,
  } = useAppState();
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [transactionTitle, setTransactionTitle] = useState("");
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await addTransaction({
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
    });

    setTransactionTitle("");
    setTransactionAmount("");
    setMerchant("");
    setTags("");
    setNote("");
    setTransactionFeedback("Transaksi tersimpan dan seluruh section finance langsung ikut terbarui.");
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

    const createdAccountId = await addAccount({
      name: accountName.trim(),
      type: accountType,
      balance: parseNumberInput(accountBalance),
    });

    setAccountId(createdAccountId);
    setRecurringAccountId(createdAccountId);
    setAccountName("");
    setAccountBalance("");
    setAccountFeedback("Akun baru sudah masuk ke Finance dan langsung bisa dipakai.");
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

    const createdCycleId = await addBudgetCycle({
      label: cycleLabelInput.trim(),
      startOn: cycleStartOnInput,
      endOn: cycleEndOnInput,
      targetAmount: parseNumberInput(cycleTargetAmountInput),
      status: cycleStatusInput,
    });

    setCycleId(createdCycleId);
    setCycleLabelInput("");
    setCycleTargetAmountInput("");
    setCycleFeedback(
      cycleStatusInput === "active"
        ? "Cycle baru aktif. Cycle aktif sebelumnya otomatis dipindahkan ke completed."
        : "Cycle baru sudah ditambahkan ke daftar budget.",
    );
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

  return (
    <div className="space-y-6">
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
                  <ActionButton type="submit">Simpan transaksi</ActionButton>
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

      {activeTab === "accounts" ? (
        <div className="space-y-6">
          <SectionCard
            description="Tambah akun, kategori, dan budget cycle baru dari satu tempat. Setelah disimpan, semua pilihan langsung muncul di form transaksi dan recurring."
            title="Finance setup"
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <form
                className="space-y-4 rounded-[24px] border border-[var(--border)] bg-white/82 p-5"
                onSubmit={handleAddAccount}
              >
                <div className="space-y-1">
                  <p className="font-semibold">Tambah akun baru</p>
                  <p className="text-sm leading-6 text-[var(--muted)]">
                    Cocok untuk rekening, cash, atau e-wallet baru.
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
                      onChange={(event) => setAccountBalance(event.target.value.replace(/\D/g, ""))}
                      placeholder="0"
                      type="text"
                      value={formatNumberInput(accountBalance)}
                    />
                  </div>
                </Field>
                <ActionButton type="submit">Tambah akun</ActionButton>
                {accountFeedback ? (
                  <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                    {accountFeedback}
                  </p>
                ) : null}
              </form>

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

              <form
                className="space-y-4 rounded-[24px] border border-[var(--border)] bg-white/82 p-5"
                onSubmit={handleAddBudgetCycle}
              >
                <div className="space-y-1">
                  <p className="font-semibold">Tambah budget cycle baru</p>
                  <p className="text-sm leading-6 text-[var(--muted)]">
                    Saat membuat cycle aktif baru, cycle aktif lama akan otomatis selesai.
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
                <ActionButton type="submit">Tambah cycle</ActionButton>
                {cycleFeedback ? (
                  <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                    {cycleFeedback}
                  </p>
                ) : null}
              </form>
            </div>
          </SectionCard>

          <SectionCard
            description="Accounts tetap fokus ke cash positions, bukan asset/investment tracking."
            title="Account balances"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            description="Setiap akun menunjukkan jejak pergerakan terakhir agar kamu bisa cepat mendeteksi sumber perubahan saldo."
            title="Recent movement by account"
          >
            <div className="grid gap-4 xl:grid-cols-3">
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
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}

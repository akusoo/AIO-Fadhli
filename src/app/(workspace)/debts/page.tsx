"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Search,
  X,
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
} from "@/components/ui";
import {
  getEffectiveInstallmentStatus,
  getInstallmentPaymentAmount,
  getNearestInstallment,
  getOpenInstallments,
} from "@/lib/debts";
import { buildTelegramDigest } from "@/lib/reminders/telegram";
import { useAppState } from "@/providers/app-state-provider";
import {
  cn,
  formatCurrency,
  formatDate,
  formatNumberInput,
  isoToday,
  parseNumberInput,
} from "@/lib/utils";

type InstallmentSortMode = "due" | "smallest" | "largest";
type DebtViewMode = "table" | "calendar";
type NewDebtInstallmentOverride = {
  dueOn?: string;
  amount?: string;
  lateFeeAmount?: string;
  note?: string;
};
const debtStatusSelectClass =
  "min-h-12 min-w-[180px] text-[15px] font-semibold leading-6 text-[var(--foreground)]";

function statusLabel(status: "healthy" | "watch" | "overdue" | "paid") {
  if (status === "healthy") {
    return "aman";
  }

  if (status === "watch") {
    return "mendekati jatuh tempo";
  }

  if (status === "overdue") {
    return "terlambat";
  }

  return "lunas";
}

function statusTone(status: "healthy" | "watch" | "overdue" | "paid") {
  if (status === "healthy") {
    return "mint";
  }

  if (status === "watch") {
    return "amber";
  }

  if (status === "overdue") {
    return "rose";
  }

  return "neutral";
}

function SortButton({
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

function daysUntil(dateText: string) {
  const today = new Date(isoToday());
  const target = new Date(dateText);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function dueLabel(dateText: string) {
  const diff = daysUntil(dateText);

  if (diff < 0) {
    return `${Math.abs(diff)} hari lewat`;
  }

  if (diff === 0) {
    return "hari ini";
  }

  if (diff === 1) {
    return "besok";
  }

  return `${diff} hari lagi`;
}

function createEditorDraft(
  installment?: {
    dueOn: string;
    amount: number;
    lateFeeAmount: number;
    effectiveStatus: "healthy" | "watch" | "overdue" | "paid";
    paidOn?: string;
    note?: string;
  },
) {
  return {
    dueOn: installment?.dueOn ?? "",
    amount: installment ? String(installment.amount) : "",
    lateFee: installment ? String(installment.lateFeeAmount) : "",
    status: installment?.effectiveStatus ?? "healthy",
    paidOn: installment?.paidOn ?? "",
    note: installment?.note ?? "",
  };
}

const weekDayLabels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function isoDateFromParts(year: number, monthIndex: number, day: number) {
  return `${year}-${padDatePart(monthIndex + 1)}-${padDatePart(day)}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function addMonthsToDateString(dateText: string, offset: number) {
  const date = new Date(dateText);
  return new Date(date.getFullYear(), date.getMonth() + offset, date.getDate())
    .toISOString()
    .slice(0, 10);
}

export default function DebtsPage() {
  const { snapshot, addDebt, setDebtInstallmentStatus, updateDebtInstallment } = useAppState();
  const [sortMode, setSortMode] = useState<InstallmentSortMode>("due");
  const [viewMode, setViewMode] = useState<DebtViewMode>("table");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCreateDebtOpen, setIsCreateDebtOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(new Date(isoToday())));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(isoToday());
  const [selectedInstallmentId, setSelectedInstallmentId] = useState(snapshot.debtInstallments[0]?.id ?? "");
  const initialDraft = createEditorDraft(
    snapshot.debtInstallments[0]
      ? {
          ...snapshot.debtInstallments[0],
          effectiveStatus: getEffectiveInstallmentStatus(snapshot.debtInstallments[0]),
        }
      : undefined,
  );
  const [editorDueOn, setEditorDueOn] = useState(initialDraft.dueOn);
  const [editorAmount, setEditorAmount] = useState(initialDraft.amount);
  const [editorLateFee, setEditorLateFee] = useState(initialDraft.lateFee);
  const [editorStatus, setEditorStatus] = useState<"healthy" | "watch" | "overdue" | "paid">(
    initialDraft.status,
  );
  const [editorPaidOn, setEditorPaidOn] = useState(initialDraft.paidOn);
  const [editorNote, setEditorNote] = useState(initialDraft.note);
  const [editorFeedback, setEditorFeedback] = useState("");
  const [newDebtName, setNewDebtName] = useState("");
  const [newDebtLender, setNewDebtLender] = useState("");
  const [newDebtPrincipal, setNewDebtPrincipal] = useState("");
  const [newDebtInstallmentAmount, setNewDebtInstallmentAmount] = useState("");
  const [newDebtMonths, setNewDebtMonths] = useState("");
  const [newDebtFirstDueOn, setNewDebtFirstDueOn] = useState(isoToday());
  const [newDebtLateFee, setNewDebtLateFee] = useState("");
  const [newDebtNote, setNewDebtNote] = useState("");
  const [newDebtInstallmentOverrides, setNewDebtInstallmentOverrides] = useState<
    Record<number, NewDebtInstallmentOverride>
  >({});
  const [expandedCreateInstallment, setExpandedCreateInstallment] = useState<number | null>(null);
  const [newDebtFeedback, setNewDebtFeedback] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDigestPreview, setShowDigestPreview] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const digest = buildTelegramDigest(snapshot);

  const installments = useMemo(() => {
    const rows = snapshot.debtInstallments.map((installment) => {
      const debt = snapshot.debts.find((item) => item.id === installment.debtId);
      const effectiveStatus = getEffectiveInstallmentStatus(installment);

      return {
        ...installment,
        debt,
        effectiveStatus,
      };
    });

    return rows.sort((left, right) => {
      if (sortMode === "smallest") {
        return getInstallmentPaymentAmount(left) - getInstallmentPaymentAmount(right);
      }

      if (sortMode === "largest") {
        return getInstallmentPaymentAmount(right) - getInstallmentPaymentAmount(left);
      }

      const dueDiff = left.dueOn.localeCompare(right.dueOn);

      if (dueDiff !== 0) {
        return dueDiff;
      }

      return (left.debt?.remainingAmount ?? 0) - (right.debt?.remainingAmount ?? 0);
    });
  }, [snapshot.debtInstallments, snapshot.debts, sortMode]);

  const selectedInstallment = useMemo(
    () =>
      installments.find((installment) => installment.id === selectedInstallmentId) ??
      installments[0],
    [installments, selectedInstallmentId],
  );

  const nearestInstallment = useMemo(() => getNearestInstallment(snapshot), [snapshot]);
  const totalRemaining = useMemo(
    () => snapshot.debts.reduce((sum, debt) => sum + debt.remainingAmount, 0),
    [snapshot.debts],
  );
  const overdueCount = useMemo(
    () => installments.filter((installment) => installment.effectiveStatus === "overdue").length,
    [installments],
  );
  const filteredInstallments = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return installments.filter((installment) => {
      const matchesQuery = !normalized
        ? true
        : [
            installment.debt?.name ?? "",
            installment.debt?.lender ?? "",
            installment.note ?? "",
            installment.debt?.note ?? "",
          ].some((value) => value.toLowerCase().includes(normalized));
      const matchesStatus =
        statusFilter === "all" ? true : installment.effectiveStatus === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [installments, query, statusFilter]);
  const reminderToday = useMemo(
    () =>
      getOpenInstallments(snapshot)
        .filter((installment) => [7, 1, 0].includes(daysUntil(installment.dueOn)))
        .slice(0, 4),
    [snapshot],
  );
  const paymentEvents = useMemo(
    () =>
      [...snapshot.debtPayments].sort((left, right) => left.paidOn.localeCompare(right.paidOn)),
    [snapshot.debtPayments],
  );
  const calendarEvents = useMemo(() => {
    const dueEvents = snapshot.debtInstallments.map((installment) => {
      const debt = snapshot.debts.find((item) => item.id === installment.debtId);
      const effectiveStatus = getEffectiveInstallmentStatus(installment);

      return {
        id: `due-${installment.id}`,
        date: installment.dueOn,
        installmentId: installment.id,
        type:
          effectiveStatus === "paid"
            ? ("paid" as const)
            : effectiveStatus === "overdue"
              ? ("overdue" as const)
              : ("due" as const),
        title: `${debt?.name ?? "Hutang"} • cicilan ${installment.installmentNumber}`,
        detail: `Jatuh tempo ${formatCurrency(getInstallmentPaymentAmount(installment))}`,
      };
    });

    const historyEvents = snapshot.debtPayments.map((payment) => {
      const debt = snapshot.debts.find((item) => item.id === payment.debtId);
      const installment = snapshot.debtInstallments.find(
        (item) => item.id === payment.installmentId,
      );

      return {
        id: `paid-${payment.id}`,
        date: payment.paidOn,
        installmentId: payment.installmentId,
        type: "paid" as const,
        title: `${debt?.name ?? "Hutang"} • cicilan ${installment?.installmentNumber ?? "-"}`,
        detail: `Pembayaran ${formatCurrency(payment.amount)}`,
      };
    });

    return [...dueEvents, ...historyEvents].sort((left, right) => left.date.localeCompare(right.date));
  }, [snapshot.debtInstallments, snapshot.debtPayments, snapshot.debts]);

  const calendarEventsByDate = useMemo(() => {
    const eventsMap = new Map<string, typeof calendarEvents>();

    calendarEvents.forEach((event) => {
      const existing = eventsMap.get(event.date) ?? [];
      existing.push(event);
      eventsMap.set(event.date, existing);
    });

    return eventsMap;
  }, [calendarEvents]);

  const calendarMonthCells = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const monthIndex = visibleMonth.getMonth();
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const startWeekday = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const daysInPreviousMonth = new Date(year, monthIndex, 0).getDate();

    return Array.from({ length: 42 }, (_, index) => {
      const relativeDay = index - startWeekday + 1;

      if (relativeDay <= 0) {
        const date = shiftMonth(visibleMonth, -1);
        const day = daysInPreviousMonth + relativeDay;
        const iso = isoDateFromParts(date.getFullYear(), date.getMonth(), day);

        return {
          iso,
          day,
          isCurrentMonth: false,
          isToday: iso === isoToday(),
          isSelected: iso === selectedCalendarDate,
          events: calendarEventsByDate.get(iso) ?? [],
        };
      }

      if (relativeDay > daysInMonth) {
        const date = shiftMonth(visibleMonth, 1);
        const day = relativeDay - daysInMonth;
        const iso = isoDateFromParts(date.getFullYear(), date.getMonth(), day);

        return {
          iso,
          day,
          isCurrentMonth: false,
          isToday: iso === isoToday(),
          isSelected: iso === selectedCalendarDate,
          events: calendarEventsByDate.get(iso) ?? [],
        };
      }

      const iso = isoDateFromParts(year, monthIndex, relativeDay);

      return {
        iso,
        day: relativeDay,
        isCurrentMonth: true,
        isToday: iso === isoToday(),
        isSelected: iso === selectedCalendarDate,
        events: calendarEventsByDate.get(iso) ?? [],
      };
    });
  }, [calendarEventsByDate, selectedCalendarDate, visibleMonth]);

  const selectedCalendarEvents = useMemo(
    () => calendarEventsByDate.get(selectedCalendarDate) ?? [],
    [calendarEventsByDate, selectedCalendarDate],
  );
  const createDebtInstallments = useMemo(() => {
    const totalMonths = parseNumberInput(newDebtMonths);

    return Array.from({ length: totalMonths }, (_, index) => {
      const override = newDebtInstallmentOverrides[index] ?? {};
      const dueOn = override.dueOn ?? addMonthsToDateString(newDebtFirstDueOn, index);
      const amountInput = override.amount ?? newDebtInstallmentAmount;
      const lateFeeInput = override.lateFeeAmount ?? newDebtLateFee;
      const note = override.note ?? newDebtNote;

      return {
        installmentNumber: index + 1,
        dueOn,
        amountInput,
        lateFeeInput,
        note,
        amount: parseNumberInput(amountInput),
        lateFeeAmount: parseNumberInput(lateFeeInput),
      };
    });
  }, [
    newDebtFirstDueOn,
    newDebtInstallmentAmount,
    newDebtInstallmentOverrides,
    newDebtLateFee,
    newDebtMonths,
    newDebtNote,
  ]);

  function updateCreateInstallmentOverride(
    installmentNumber: number,
    patch: NewDebtInstallmentOverride,
  ) {
    setNewDebtInstallmentOverrides((current) => ({
      ...current,
      [installmentNumber - 1]: {
        ...current[installmentNumber - 1],
        ...patch,
      },
    }));
  }

  function openInstallmentEditor(installment: (typeof installments)[number]) {
    const draft = createEditorDraft(installment);
    setSelectedInstallmentId(installment.id);
    setEditorDueOn(draft.dueOn);
    setEditorAmount(draft.amount);
    setEditorLateFee(draft.lateFee);
    setEditorStatus(draft.status);
    setEditorPaidOn(draft.paidOn);
    setEditorNote(draft.note);
    setEditorFeedback("");
    setIsEditorOpen(true);
  }

  async function handleEditorSave() {
    if (!selectedInstallment) {
      return;
    }

    await updateDebtInstallment({
      installmentId: selectedInstallment.id,
      dueOn: editorDueOn,
      amount: parseNumberInput(editorAmount),
      lateFeeAmount: parseNumberInput(editorLateFee),
      note: editorNote || undefined,
      paidOn: editorPaidOn || undefined,
    });

    await setDebtInstallmentStatus({
      debtId: selectedInstallment.debtId,
      installmentId: selectedInstallment.id,
      status: editorStatus,
      paidOn: editorStatus === "paid" ? editorPaidOn || isoToday() : undefined,
      note: editorNote || undefined,
    });

    setEditorFeedback("Detail cicilan diperbarui, histori dan finance ikut tersinkron.");
  }

  async function handleCreateDebt() {
    const principalAmount = parseNumberInput(newDebtPrincipal);
    const installmentAmount = parseNumberInput(newDebtInstallmentAmount);
    const totalMonths = parseNumberInput(newDebtMonths);
    const lateFeeAmount = parseNumberInput(newDebtLateFee);

    if (!newDebtName || !newDebtLender || !newDebtFirstDueOn) {
      setNewDebtFeedback("Lengkapi nama pinjaman, pemberi pinjaman, dan jatuh tempo pertama.");
      return;
    }

    if (!principalAmount || !installmentAmount || !totalMonths) {
      setNewDebtFeedback("Nominal total, nominal cicilan, dan tenor harus lebih dari 0.");
      return;
    }

    if (
      createDebtInstallments.some(
        (installment) => !installment.dueOn || installment.amount <= 0,
      )
    ) {
      setNewDebtFeedback("Setiap cicilan harus punya jatuh tempo dan nominal yang valid.");
      return;
    }

    await addDebt({
      name: newDebtName,
      lender: newDebtLender,
      principalAmount,
      installmentAmount,
      totalMonths,
      firstDueOn: newDebtFirstDueOn,
      lateFeeAmount,
      note: newDebtNote || undefined,
      installments: createDebtInstallments.map((installment) => ({
        installmentNumber: installment.installmentNumber,
        dueOn: installment.dueOn,
        amount: installment.amount,
        lateFeeAmount: installment.lateFeeAmount,
        note: installment.note || undefined,
      })),
    });

    setSortMode("due");
    setVisibleMonth(getMonthStart(new Date(newDebtFirstDueOn)));
    setSelectedCalendarDate(newDebtFirstDueOn);
    setNewDebtName("");
    setNewDebtLender("");
    setNewDebtPrincipal("");
    setNewDebtInstallmentAmount("");
    setNewDebtMonths("");
    setNewDebtFirstDueOn(isoToday());
    setNewDebtLateFee("");
    setNewDebtNote("");
    setNewDebtInstallmentOverrides({});
    setExpandedCreateInstallment(null);
    setNewDebtFeedback("");
    setIsCreateDebtOpen(false);
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        eyebrow="Core flow / debt installments"
        title="Hutang sekarang dibaca per cicilan, bukan hanya per akun."
        description="Table detail, kalender, reminder, dan histori tetap ada, tetapi sekarang lebih mudah discan saat cicilan mulai banyak."
        actions={<ActionButton onClick={() => setIsCreateDebtOpen(true)}>Tambah pinjaman</ActionButton>}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[22px] bg-[rgba(16,33,43,0.92)] px-4 py-4 text-white">
          <p className="text-xs uppercase tracking-[0.18em] text-white/70">Total sisa hutang</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(totalRemaining)}</p>
        </div>
        <div className="rounded-[22px] bg-white/78 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Terdekat</p>
          <p className="mt-2 text-lg font-semibold">
            {nearestInstallment ? formatDate(nearestInstallment.dueOn) : "-"}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {nearestInstallment
              ? `${dueLabel(nearestInstallment.dueOn)} • cicilan ${nearestInstallment.installmentNumber}`
              : "Tidak ada cicilan aktif"}
          </p>
        </div>
        <div className="rounded-[22px] bg-white/78 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Reminder hari ini</p>
          <p className="mt-2 text-lg font-semibold">{reminderToday.length} cicilan</p>
          <p className="mt-1 text-sm text-[var(--muted)]">H-7, H-1, dan hari H.</p>
        </div>
        <div className="rounded-[22px] bg-white/78 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Terlambat</p>
          <p className="mt-2 text-lg font-semibold">{overdueCount} cicilan</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Perlu ditangani lebih dulu.</p>
        </div>
      </div>

      <div className="grid min-w-0 items-start gap-6">
        <SectionCard
          className="min-w-0 overflow-hidden"
          description="Table detail dan kalender tetap satu ritme agar mudah berpindah."
          title={viewMode === "table" ? "Table cicilan" : "Calendar view"}
        >
          <div className="min-w-0 space-y-5">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap gap-2">
                <SortButton
                  active={viewMode === "table"}
                  label="Table view"
                  onClick={() => setViewMode("table")}
                />
                <SortButton
                  active={viewMode === "calendar"}
                  label="Calendar view"
                  onClick={() => setViewMode("calendar")}
                />
              </div>
              {viewMode === "table" ? (
                <div className="flex min-w-0 flex-wrap gap-2">
                  <SortButton
                    active={sortMode === "due"}
                    label="Terdekat dulu"
                    onClick={() => setSortMode("due")}
                  />
                  <SortButton
                    active={sortMode === "smallest"}
                    label="Nominal terkecil"
                    onClick={() => setSortMode("smallest")}
                  />
                  <SortButton
                    active={sortMode === "largest"}
                    label="Nominal terbesar"
                    onClick={() => setSortMode("largest")}
                  />
                </div>
              ) : null}
            </div>

            {viewMode === "table" ? (
              <>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
                      strokeWidth={2.2}
                    />
                    <Input
                      className="pl-11"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Cari nama hutang, lender, atau catatan"
                      value={query}
                    />
                  </div>
                  <Select
                    onChange={(event) => setStatusFilter(event.target.value)}
                    value={statusFilter}
                  >
                    <option value="all">Semua status</option>
                    <option value="healthy">aman</option>
                    <option value="watch">mendekati jatuh tempo</option>
                    <option value="overdue">terlambat</option>
                    <option value="paid">lunas</option>
                  </Select>
                </div>

                {filteredInstallments.length === 0 ? (
                  <EmptyState
                    description="Tidak ada cicilan yang cocok dengan pencarian atau filter status saat ini."
                    title="Table cicilan kosong"
                  />
                ) : null}

                {filteredInstallments.length > 0 ? (
                <div className="space-y-3 xl:hidden">
                  {filteredInstallments.map((installment) => (
                    <div
                      className={cn(
                        "rounded-[22px] border border-[var(--border)] bg-white/82 p-4",
                        selectedInstallmentId === installment.id && "ring-1 ring-[var(--accent)]",
                      )}
                      key={`card-${installment.id}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{installment.debt?.name}</p>
                            <Pill tone={statusTone(installment.effectiveStatus)}>
                              {statusLabel(installment.effectiveStatus)}
                            </Pill>
                          </div>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {installment.debt?.lender} • cicilan {installment.installmentNumber}
                          </p>
                        </div>
                        <p className="text-sm font-semibold">
                          {formatCurrency(getInstallmentPaymentAmount(installment))}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[18px] bg-[var(--surface)] p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                            Jatuh tempo
                          </p>
                          <p className="mt-2 text-sm font-medium">{formatDate(installment.dueOn)}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{dueLabel(installment.dueOn)}</p>
                        </div>
                        <div className="rounded-[18px] bg-[var(--surface)] p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                            Sisa cicilan
                          </p>
                          <p className="mt-2 text-sm font-medium">
                            {installment.debt?.remainingMonths} / {installment.debt?.totalMonths}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {installment.paidOn ? `dibayar ${formatDate(installment.paidOn)}` : "belum dibayar"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3">
                        <Field label="Status">
                          <Select
                            className={debtStatusSelectClass}
                            onChange={(event) => {
                              void setDebtInstallmentStatus({
                                debtId: installment.debtId,
                                installmentId: installment.id,
                                status: event.target.value as "healthy" | "watch" | "overdue" | "paid",
                                paidOn:
                                  event.target.value === "paid"
                                    ? installment.paidOn ?? isoToday()
                                    : undefined,
                                note: installment.note,
                              });
                            }}
                            value={installment.effectiveStatus}
                          >
                            <option value="healthy">aman</option>
                            <option value="watch">mendekati jatuh tempo</option>
                            <option value="overdue">terlambat</option>
                            <option value="paid">lunas</option>
                          </Select>
                        </Field>
                        <div className="flex flex-wrap gap-3">
                          <button
                            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]"
                            onClick={() => openInstallmentEditor(installment)}
                            type="button"
                          >
                            Buka detail
                          </button>
                          {installment.lateFeeAmount ? (
                            <Pill tone="amber">Biaya telat {formatCurrency(installment.lateFeeAmount)}</Pill>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                ) : null}

                {filteredInstallments.length > 0 ? (
                <div className="hidden max-w-full xl:block">
                  <div className="max-w-full overflow-x-auto pb-1">
                    <table className="w-full min-w-[980px] border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                        <th className="px-3 py-2">Hutang</th>
                        <th className="px-3 py-2">Pemberi</th>
                        <th className="px-3 py-2">Cicilan</th>
                        <th className="px-3 py-2">Nominal</th>
                        <th className="px-3 py-2">Jatuh tempo</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Tanggal bayar</th>
                        <th className="px-3 py-2">Biaya telat</th>
                        <th className="px-3 py-2">Catatan</th>
                        <th className="px-3 py-2">Sisa cicilan</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInstallments.map((installment) => (
                        <tr
                          className={cn(
                            "rounded-[20px] bg-white/80 shadow-[0_8px_24px_rgba(16,33,43,0.06)]",
                            selectedInstallmentId === installment.id && "ring-1 ring-[var(--accent)]",
                          )}
                          key={installment.id}
                        >
                          <td className="rounded-l-[20px] px-3 py-4 align-top">
                            <div className="max-w-[320px]">
                              <p className="break-words font-semibold">{installment.debt?.name}</p>
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                {installment.debt?.note ?? "Tanpa catatan utama"}
                              </p>
                            </div>
                          </td>
                          <td className="px-3 py-4 align-top text-sm">{installment.debt?.lender}</td>
                          <td className="px-3 py-4 align-top text-sm">
                            Cicilan {installment.installmentNumber}
                          </td>
                          <td className="px-3 py-4 align-top text-sm">
                            {formatCurrency(getInstallmentPaymentAmount(installment))}
                          </td>
                          <td className="px-3 py-4 align-top text-sm">
                            <p>{formatDate(installment.dueOn)}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{dueLabel(installment.dueOn)}</p>
                          </td>
                          <td className="px-3 py-4 align-top">
                            <Select
                              className={debtStatusSelectClass}
                              onChange={(event) => {
                                void setDebtInstallmentStatus({
                                  debtId: installment.debtId,
                                  installmentId: installment.id,
                                  status: event.target.value as "healthy" | "watch" | "overdue" | "paid",
                                  paidOn:
                                    event.target.value === "paid"
                                      ? installment.paidOn ?? isoToday()
                                      : undefined,
                                  note: installment.note,
                                });
                              }}
                              value={installment.effectiveStatus}
                            >
                              <option value="healthy">aman</option>
                              <option value="watch">mendekati jatuh tempo</option>
                              <option value="overdue">terlambat</option>
                              <option value="paid">lunas</option>
                            </Select>
                          </td>
                          <td className="px-3 py-4 align-top text-sm">
                            {installment.paidOn ? formatDate(installment.paidOn) : "-"}
                          </td>
                          <td className="px-3 py-4 align-top text-sm">
                            {installment.lateFeeAmount
                              ? formatCurrency(installment.lateFeeAmount)
                              : "-"}
                          </td>
                          <td className="max-w-[180px] px-3 py-4 align-top text-sm text-[var(--muted)]">
                            {installment.note ?? "-"}
                          </td>
                          <td className="px-3 py-4 align-top text-sm">
                            {installment.debt?.remainingMonths} / {installment.debt?.totalMonths}
                          </td>
                          <td className="rounded-r-[20px] px-3 py-4 align-top">
                            <button
                              className="rounded-full border border-[var(--border)] px-3 py-2 text-xs font-medium hover:bg-[var(--surface)]"
                              onClick={() => openInstallmentEditor(installment)}
                              type="button"
                            >
                              Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
                ) : null}
              </>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Kalender bulanan cicilan</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Jatuh tempo dan histori pembayaran ditampilkan langsung di kalender.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      aria-label="Bulan lalu"
                      className="flex size-10 items-center justify-center rounded-full border border-[var(--border)] bg-white/80 text-[var(--foreground)] hover:bg-white"
                      onClick={() => {
                        const previousMonth = shiftMonth(visibleMonth, -1);
                        setVisibleMonth(previousMonth);
                        setSelectedCalendarDate(
                          isoDateFromParts(
                            previousMonth.getFullYear(),
                            previousMonth.getMonth(),
                            1,
                          ),
                        );
                      }}
                      type="button"
                    >
                      <ChevronLeft className="size-4" strokeWidth={2.4} />
                    </button>
                    <button
                      className="rounded-full border border-[var(--border)] bg-white/80 px-3 py-2 text-sm font-medium hover:bg-white"
                      onClick={() => {
                        const currentMonth = getMonthStart(new Date(isoToday()));
                        setVisibleMonth(currentMonth);
                        setSelectedCalendarDate(isoToday());
                      }}
                      type="button"
                    >
                      Bulan ini
                    </button>
                    <button
                      aria-label="Bulan depan"
                      className="flex size-10 items-center justify-center rounded-full border border-[var(--border)] bg-white/80 text-[var(--foreground)] hover:bg-white"
                      onClick={() => {
                        const nextMonth = shiftMonth(visibleMonth, 1);
                        setVisibleMonth(nextMonth);
                        setSelectedCalendarDate(
                          isoDateFromParts(nextMonth.getFullYear(), nextMonth.getMonth(), 1),
                        );
                      }}
                      type="button"
                    >
                      <ChevronRight className="size-4" strokeWidth={2.4} />
                    </button>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[var(--border)] bg-white/70 p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold capitalize">{monthLabel(visibleMonth)}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Pilih tanggal untuk melihat detail event hari itu.
                      </p>
                    </div>
                    <div className="hidden flex-wrap gap-2 sm:flex">
                      <Pill tone="amber">jatuh tempo</Pill>
                      <Pill tone="rose">terlambat</Pill>
                      <Pill tone="mint">pembayaran</Pill>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)] sm:gap-2 sm:text-xs">
                    {weekDayLabels.map((label) => (
                      <div className="rounded-2xl bg-[var(--surface)] px-2 py-2" key={label}>
                        {label}
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
                    {calendarMonthCells.map((cell) => (
                      <button
                        className={cn(
                          "min-h-24 rounded-[20px] border p-2 text-left align-top transition-colors sm:min-h-28 sm:p-3",
                          cell.isCurrentMonth
                            ? "border-[var(--border)] bg-white/82"
                            : "border-transparent bg-[var(--surface)] text-[var(--muted)]",
                          cell.isSelected && "border-[var(--accent)] ring-1 ring-[var(--accent)]",
                          cell.isToday && "shadow-[inset_0_0_0_1px_rgba(44,120,112,0.22)]",
                        )}
                        key={cell.iso}
                        onClick={() => {
                          setSelectedCalendarDate(cell.iso);
                          if (!cell.isCurrentMonth) {
                            setVisibleMonth(getMonthStart(new Date(cell.iso)));
                          }
                        }}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold">{cell.day}</span>
                          {cell.events.length ? (
                            <span className="rounded-full bg-[var(--foreground)] px-2 py-0.5 text-[10px] font-medium text-white">
                              {cell.events.length}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 space-y-1.5">
                          {cell.events.slice(0, 2).map((event) => (
                            <div
                              className={cn(
                                "rounded-xl px-2 py-1 text-[10px] font-medium leading-4 sm:text-[11px]",
                                event.type === "paid" && "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
                                event.type === "due" && "bg-[rgba(218,108,44,0.12)] text-[var(--warn)]",
                                event.type === "overdue" && "bg-[rgba(166,64,77,0.12)] text-[var(--rose)]",
                              )}
                              key={event.id}
                            >
                              {event.type === "paid"
                                ? "Pembayaran"
                                : event.type === "overdue"
                                  ? "Terlambat"
                                  : "Jatuh tempo"}
                            </div>
                          ))}
                          {cell.events.length > 2 ? (
                            <p className="text-[10px] text-[var(--muted)] sm:text-[11px]">
                              +{cell.events.length - 2} event lain
                            </p>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                  <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-4 text-[var(--muted)]" strokeWidth={2.2} />
                      <p className="text-sm font-semibold">Tanggal terpilih</p>
                    </div>
                    <p className="mt-3 text-2xl font-semibold">{formatDate(selectedCalendarDate)}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {selectedCalendarEvents.length
                        ? `${selectedCalendarEvents.length} event ada di hari ini.`
                        : "Tidak ada event di tanggal ini."}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {selectedCalendarEvents.length === 0 ? (
                      <EmptyState
                        description="Pilih tanggal lain untuk melihat jatuh tempo atau histori pembayaran."
                        title="Tanggal ini kosong"
                      />
                    ) : null}

                    {selectedCalendarEvents.map((event) => {
                      const linkedInstallment = event.installmentId
                        ? installments.find((installment) => installment.id === event.installmentId)
                        : undefined;

                      return (
                        <div
                          className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
                          key={event.id}
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Pill
                                  tone={
                                    event.type === "paid"
                                      ? "mint"
                                      : event.type === "overdue"
                                        ? "rose"
                                        : "amber"
                                  }
                                >
                                  {event.type === "paid"
                                    ? "pembayaran"
                                    : event.type === "overdue"
                                      ? "terlambat"
                                      : "jatuh tempo"}
                                </Pill>
                                <p className="font-medium">{event.title}</p>
                              </div>
                              <p className="mt-2 text-sm text-[var(--muted)]">{event.detail}</p>
                            </div>
                            {linkedInstallment ? (
                              <button
                                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]"
                                onClick={() => openInstallmentEditor(linkedInstallment)}
                                type="button"
                              >
                                Buka detail
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <SectionCard
              description="Nearest action dan reminder utama tanpa membuat panel ini terlalu berat."
              title="Reminder"
            >
          <div className="space-y-4">
            <div className="rounded-[22px] bg-[var(--surface)] p-4">
              <p className="text-sm font-semibold">Cicilan terdekat</p>
              {nearestInstallment ? (
                <div className="mt-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {
                        snapshot.debts.find((debt) => debt.id === nearestInstallment.debtId)?.name
                      }{" "}
                      • cicilan {nearestInstallment.installmentNumber}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {formatDate(nearestInstallment.dueOn)} • {dueLabel(nearestInstallment.dueOn)}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatCurrency(getInstallmentPaymentAmount(nearestInstallment))}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--muted)]">Tidak ada cicilan aktif.</p>
              )}
            </div>

            <div className="space-y-3">
              {reminderToday.length === 0 ? (
                <EmptyState
                  description="Tidak ada reminder H-7, H-1, atau hari H yang aktif untuk hari ini."
                  title="Reminder kosong"
                />
              ) : null}
              {reminderToday.map((installment) => {
                const debt = snapshot.debts.find((item) => item.id === installment.debtId);

                return (
                  <div
                    className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4"
                    key={`reminder-${installment.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">
                          {debt?.name} • cicilan {installment.installmentNumber}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {formatDate(installment.dueOn)} • {dueLabel(installment.dueOn)}
                        </p>
                      </div>
                      <Pill tone={statusTone(getEffectiveInstallmentStatus(installment))}>
                        {statusLabel(getEffectiveInstallmentStatus(installment))}
                      </Pill>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-[22px] border border-[var(--border)] bg-white/78 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Preview digest Telegram</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Buka hanya saat ingin mengecek ringkasan reminder yang dikirim.
                  </p>
                </div>
                <ActionButton
                  onClick={() => setShowDigestPreview((current) => !current)}
                  variant="ghost"
                >
                  {showDigestPreview ? "Sembunyikan" : "Lihat preview"}
                </ActionButton>
              </div>
              {showDigestPreview ? (
                <pre className="mt-4 whitespace-pre-wrap rounded-[18px] bg-[var(--foreground)] p-4 font-mono text-xs leading-6 text-white/82">
                  {digest}
                </pre>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          description="Histori pembayaran tetap ada, tetapi diringkas agar tidak mengambil fokus utama."
          title="Payment history"
        >
          <div className="space-y-3">
            {paymentEvents.length === 0 ? (
              <EmptyState
                description="Belum ada histori pembayaran yang tersimpan."
                title="Histori masih kosong"
              />
            ) : null}
            {paymentEvents.slice(0, showAllPayments ? undefined : 5).map((payment) => {
              const debt = snapshot.debts.find((item) => item.id === payment.debtId);
              const installment = snapshot.debtInstallments.find(
                (item) => item.id === payment.installmentId,
              );

              return (
                <div
                  className="rounded-[24px] border border-[var(--border)] bg-white/80 p-4"
                  key={payment.id}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold">
                        {debt?.name} • cicilan {installment?.installmentNumber}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {formatDate(payment.paidOn)}
                        {payment.note ? ` • ${payment.note}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Sisa setelah bayar {formatCurrency(payment.remainingAmount)}
                      </p>
                    </div>
                    <p className="text-lg font-semibold">{formatCurrency(payment.amount)}</p>
                  </div>
                </div>
              );
            })}
            {paymentEvents.length > 5 ? (
              <ActionButton
                onClick={() => setShowAllPayments((current) => !current)}
                variant="ghost"
              >
                {showAllPayments ? "Tampilkan lebih sedikit" : `Tampilkan semua (${paymentEvents.length})`}
              </ActionButton>
            ) : null}
          </div>
        </SectionCard>
      </div>

      {isEditorOpen && selectedInstallment ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(23,37,47,0.42)] p-4 sm:p-6"
          onClick={() => setIsEditorOpen(false)}
          role="dialog"
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-[var(--border)] bg-[rgba(255,252,249,0.98)] p-5 shadow-[var(--shadow-lg)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Detail editor
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  Ubah cicilan ini tanpa mengganggu view utama
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  Editor ini dipakai untuk mengubah cicilan tertentu secara spesifik tanpa harus
                  mengedit semuanya.
                </p>
              </div>
              <button
                aria-label="Tutup editor"
                className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--foreground)] transition-colors hover:bg-white"
                onClick={() => setIsEditorOpen(false)}
                type="button"
              >
                <X className="size-4" strokeWidth={2.4} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-[22px] bg-white/82 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={statusTone(selectedInstallment.effectiveStatus)}>
                    {statusLabel(selectedInstallment.effectiveStatus)}
                  </Pill>
                  <Pill>Cicilan {selectedInstallment.installmentNumber}</Pill>
                </div>
                <p className="mt-3 text-lg font-semibold">{selectedInstallment.debt?.name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {selectedInstallment.debt?.lender} • sisa {selectedInstallment.debt?.remainingMonths} /{" "}
                  {selectedInstallment.debt?.totalMonths}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Status">
                  <Select
                    className={debtStatusSelectClass}
                    onChange={(event) =>
                      setEditorStatus(
                        event.target.value as "healthy" | "watch" | "overdue" | "paid",
                      )
                    }
                    value={editorStatus}
                  >
                    <option value="healthy">aman</option>
                    <option value="watch">mendekati jatuh tempo</option>
                    <option value="overdue">terlambat</option>
                    <option value="paid">lunas</option>
                  </Select>
                </Field>
                <Field label="Tanggal jatuh tempo">
                  <Input
                    onChange={(event) => setEditorDueOn(event.target.value)}
                    type="date"
                    value={editorDueOn}
                  />
                </Field>
                <Field label="Nominal cicilan">
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-[var(--muted)]">
                      Rp
                    </span>
                    <Input
                      className="pl-11"
                      inputMode="numeric"
                      onChange={(event) => setEditorAmount(event.target.value.replace(/\D/g, ""))}
                      type="text"
                      value={formatNumberInput(editorAmount)}
                    />
                  </div>
                </Field>
                <Field label="Biaya telat">
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-[var(--muted)]">
                      Rp
                    </span>
                    <Input
                      className="pl-11"
                      inputMode="numeric"
                      onChange={(event) => setEditorLateFee(event.target.value.replace(/\D/g, ""))}
                      type="text"
                      value={formatNumberInput(editorLateFee)}
                    />
                  </div>
                </Field>
                <Field label="Tanggal bayar">
                  <Input
                    onChange={(event) => setEditorPaidOn(event.target.value)}
                    type="date"
                    value={editorPaidOn}
                  />
                </Field>
                <Field label="Catatan">
                  <Input
                    onChange={(event) => setEditorNote(event.target.value)}
                    placeholder="Contoh: sudah transfer ke teman"
                    value={editorNote}
                  />
                </Field>
              </div>

              <div className="rounded-[22px] border border-[var(--border)] bg-white/80 p-4">
                <p className="text-sm font-semibold">Total pembayaran cicilan ini</p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatCurrency(
                    parseNumberInput(editorAmount) + parseNumberInput(editorLateFee),
                  )}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Saat status diubah ke `lunas`, total ini otomatis masuk ke histori pembayaran
                  dan tercatat ke Finance dengan kategori `Cicilan`.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <ActionButton onClick={() => void handleEditorSave()}>
                  Simpan perubahan
                </ActionButton>
                <ActionButton
                  onClick={() => {
                    void setDebtInstallmentStatus({
                      debtId: selectedInstallment.debtId,
                      installmentId: selectedInstallment.id,
                      status: "paid",
                      paidOn: editorPaidOn || isoToday(),
                      note: editorNote || undefined,
                    });
                    setEditorFeedback("Cicilan ditandai lunas dan otomatis masuk ke Finance.");
                  }}
                  variant="secondary"
                >
                  Tandai lunas
                </ActionButton>
                <ActionButton onClick={() => setIsEditorOpen(false)} variant="ghost">
                  Tutup
                </ActionButton>
              </div>

              {editorFeedback ? (
                <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                  {editorFeedback}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isCreateDebtOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(23,37,47,0.42)] p-4 sm:p-6"
          onClick={() => setIsCreateDebtOpen(false)}
          role="dialog"
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-[var(--border)] bg-[rgba(255,252,249,0.98)] p-5 shadow-[var(--shadow-lg)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Tambah pinjaman
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  Buat hutang baru lalu generate cicilan otomatis
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  Isi data inti pinjaman terlebih dulu. Sistem akan membuat baris cicilan dari
                  tenor dan nominal cicilan, lalu nanti tiap cicilan tetap bisa kamu edit spesifik.
                </p>
              </div>
              <button
                aria-label="Tutup tambah pinjaman"
                className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--foreground)] transition-colors hover:bg-white"
                onClick={() => setIsCreateDebtOpen(false)}
                type="button"
              >
                <X className="size-4" strokeWidth={2.4} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Nama pinjaman">
                <Input
                  onChange={(event) => setNewDebtName(event.target.value)}
                  placeholder="Contoh: Talangan tiket"
                  value={newDebtName}
                />
              </Field>
              <Field label="Pemberi pinjaman">
                <Input
                  onChange={(event) => setNewDebtLender(event.target.value)}
                  placeholder="Contoh: Teman, Shopee PayLater"
                  value={newDebtLender}
                />
              </Field>
              <Field label="Nominal total pinjaman">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-[var(--muted)]">
                    Rp
                  </span>
                  <Input
                    className="pl-11"
                    inputMode="numeric"
                    onChange={(event) => setNewDebtPrincipal(event.target.value.replace(/\D/g, ""))}
                    type="text"
                    value={formatNumberInput(newDebtPrincipal)}
                  />
                </div>
              </Field>
              <Field label="Nominal cicilan per periode">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-[var(--muted)]">
                    Rp
                  </span>
                  <Input
                    className="pl-11"
                    inputMode="numeric"
                    onChange={(event) =>
                      setNewDebtInstallmentAmount(event.target.value.replace(/\D/g, ""))
                    }
                    type="text"
                    value={formatNumberInput(newDebtInstallmentAmount)}
                  />
                </div>
              </Field>
              <Field label="Tenor (bulan)">
                <Input
                  inputMode="numeric"
                  onChange={(event) => setNewDebtMonths(event.target.value.replace(/\D/g, ""))}
                  placeholder="Contoh: 6"
                  type="text"
                  value={newDebtMonths}
                />
              </Field>
              <Field label="Jatuh tempo pertama">
                <Input
                  onChange={(event) => setNewDebtFirstDueOn(event.target.value)}
                  type="date"
                  value={newDebtFirstDueOn}
                />
              </Field>
              <Field label="Biaya telat default per cicilan">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-[var(--muted)]">
                    Rp
                  </span>
                  <Input
                    className="pl-11"
                    inputMode="numeric"
                    onChange={(event) => setNewDebtLateFee(event.target.value.replace(/\D/g, ""))}
                    type="text"
                    value={formatNumberInput(newDebtLateFee)}
                  />
                </div>
              </Field>
              <Field label="Catatan utama">
                <Input
                  onChange={(event) => setNewDebtNote(event.target.value)}
                  placeholder="Contoh: pinjam dulu untuk tiket mudik"
                  value={newDebtNote}
                />
              </Field>
            </div>

            <div className="mt-5 rounded-[22px] border border-[var(--border)] bg-white/80 p-4">
              <p className="text-sm font-semibold">Preview generator cicilan</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {createDebtInstallments.length > 0
                  ? `${createDebtInstallments.length} cicilan akan dibuat mulai ${formatDate(
                      newDebtFirstDueOn,
                    )} dengan nominal ${formatCurrency(
                      parseNumberInput(newDebtInstallmentAmount),
                    )} per periode.`
                  : "Isi tenor dan nominal cicilan untuk melihat hasil generatornya."}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Edit cicilan spesifik</p>
                <p className="text-xs text-[var(--muted)]">
                  Generator tetap jadi default, tapi tiap cicilan bisa kamu ubah satu per satu.
                </p>
              </div>

              {createDebtInstallments.length === 0 ? (
                <EmptyState
                  description="Isi tenor dulu supaya daftar cicilan yang bisa diedit muncul."
                  title="Belum ada cicilan untuk diedit"
                />
              ) : null}

              {createDebtInstallments.map((installment) => {
                const isExpanded = expandedCreateInstallment === installment.installmentNumber;

                return (
                  <div
                    className="rounded-[22px] border border-[var(--border)] bg-white/78 p-4"
                    key={`create-installment-${installment.installmentNumber}`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill>Cicilan {installment.installmentNumber}</Pill>
                          <p className="text-sm text-[var(--muted)]">
                            {formatDate(installment.dueOn)} •{" "}
                            {formatCurrency(installment.amount + installment.lateFeeAmount)}
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          Biaya telat default {formatCurrency(installment.lateFeeAmount)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]"
                          onClick={() =>
                            setExpandedCreateInstallment((current) =>
                              current === installment.installmentNumber
                                ? null
                                : installment.installmentNumber,
                            )
                          }
                          type="button"
                        >
                          {isExpanded ? "Tutup edit" : "Edit cicilan"}
                        </button>
                        <button
                          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]"
                          onClick={() =>
                            setNewDebtInstallmentOverrides((current) => {
                              const next = { ...current };
                              delete next[installment.installmentNumber - 1];
                              return next;
                            })
                          }
                          type="button"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Tanggal jatuh tempo">
                          <Input
                            onChange={(event) =>
                              updateCreateInstallmentOverride(installment.installmentNumber, {
                                dueOn: event.target.value,
                              })
                            }
                            type="date"
                            value={installment.dueOn}
                          />
                        </Field>
                        <Field label="Nominal cicilan">
                          <div className="relative">
                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-[var(--muted)]">
                              Rp
                            </span>
                            <Input
                              className="pl-11"
                              inputMode="numeric"
                              onChange={(event) =>
                                updateCreateInstallmentOverride(installment.installmentNumber, {
                                  amount: event.target.value.replace(/\D/g, ""),
                                })
                              }
                              type="text"
                              value={formatNumberInput(installment.amountInput)}
                            />
                          </div>
                        </Field>
                        <Field label="Biaya telat">
                          <div className="relative">
                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-[var(--muted)]">
                              Rp
                            </span>
                            <Input
                              className="pl-11"
                              inputMode="numeric"
                              onChange={(event) =>
                                updateCreateInstallmentOverride(installment.installmentNumber, {
                                  lateFeeAmount: event.target.value.replace(/\D/g, ""),
                                })
                              }
                              type="text"
                              value={formatNumberInput(installment.lateFeeInput)}
                            />
                          </div>
                        </Field>
                        <Field label="Catatan cicilan">
                          <Input
                            onChange={(event) =>
                              updateCreateInstallmentOverride(installment.installmentNumber, {
                                note: event.target.value,
                              })
                            }
                            placeholder="Opsional untuk cicilan ini saja"
                            value={installment.note}
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <ActionButton onClick={() => void handleCreateDebt()}>
                Simpan pinjaman
              </ActionButton>
              <ActionButton onClick={() => setIsCreateDebtOpen(false)} variant="ghost">
                Tutup
              </ActionButton>
            </div>

            {newDebtFeedback ? (
              <p className="mt-4 rounded-2xl bg-[rgba(166,64,77,0.12)] px-4 py-3 text-sm text-[var(--rose)]">
                {newDebtFeedback}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

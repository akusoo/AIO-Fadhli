import type { AppSnapshot, Task } from "@/lib/domain/models";
import {
  getEffectiveInstallmentStatus,
  getInstallmentPaymentAmount,
  getNearestInstallment,
  getOpenInstallments,
} from "@/lib/debts";
import { getTodayTasks } from "@/lib/tasks";
import { formatCurrency, formatDate, isoToday } from "@/lib/utils";

function buildTaskContext(task: Task, snapshot: AppSnapshot, today: string) {
  const projectName = task.projectId
    ? snapshot.projects.find((project) => project.id === task.projectId)?.name
    : undefined;
  const parts: string[] = [];

  if (projectName) {
    parts.push(`project ${projectName}`);
  }

  if (task.startTime) {
    parts.push(`mulai ${task.startTime}`);
  } else if (task.dueTime) {
    parts.push(`jam ${task.dueTime}`);
  }

  if (task.dueOn && task.dueOn !== today) {
    parts.push(`due ${formatDate(task.dueOn)}`);
  }

  return parts.length ? ` • ${parts.join(" • ")}` : "";
}

function buildBudgetLines(snapshot: AppSnapshot) {
  const activeCycle = snapshot.budgetCycles.find((cycle) => cycle.status === "active");

  if (!activeCycle) {
    return ["Budget aktif", "Belum ada budget cycle aktif."];
  }

  const remainingBudget = activeCycle.targetAmount - activeCycle.spentAmount;

  return [
    "Budget aktif",
    `${activeCycle.label}: ${formatCurrency(activeCycle.spentAmount)} dari ${formatCurrency(activeCycle.targetAmount)}`,
    `Sisa target: ${formatCurrency(remainingBudget)}`,
  ];
}

function buildDebtLines(snapshot: AppSnapshot) {
  const openInstallments = getOpenInstallments(snapshot);
  const overdueInstallments = openInstallments.filter(
    (installment) => getEffectiveInstallmentStatus(installment) === "overdue",
  );
  const nearestInstallment = getNearestInstallment(snapshot);

  if (!openInstallments.length) {
    return ["Cicilan", "Tidak ada cicilan aktif."];
  }

  const lines = ["Cicilan"];

  if (overdueInstallments.length) {
    lines.push(
      `Terlambat: ${overdueInstallments
        .slice(0, 3)
        .map((installment) => {
          const debt = snapshot.debts.find((item) => item.id === installment.debtId);
          return `${debt?.name ?? "Hutang"} #${installment.installmentNumber}`;
        })
        .join(", ")}`,
    );
  } else {
    lines.push("Terlambat: tidak ada.");
  }

  if (nearestInstallment) {
    const nearestDebt = snapshot.debts.find((item) => item.id === nearestInstallment.debtId);
    lines.push(
      `Terdekat: ${nearestDebt?.name ?? "Hutang"} #${nearestInstallment.installmentNumber} • ${formatDate(nearestInstallment.dueOn)} • ${formatCurrency(getInstallmentPaymentAmount(nearestInstallment))}`,
    );
  }

  return lines;
}

function buildTodayTaskLines(snapshot: AppSnapshot, today: string) {
  const todayTasks = getTodayTasks(snapshot.tasks, today).slice(0, 5);

  if (!todayTasks.length) {
    return ["Fokus hari ini", "Tidak ada task aktif untuk hari ini."];
  }

  return [
    "Fokus hari ini",
    ...todayTasks.map(
      (task, index) => `${index + 1}. ${task.title}${buildTaskContext(task, snapshot, today)}`,
    ),
  ];
}

export function buildTelegramDigest(snapshot: AppSnapshot, today = isoToday()) {
  return [
    "Ringkasan AIO Personal Tracker",
    formatDate(today),
    "",
    ...buildBudgetLines(snapshot),
    "",
    ...buildDebtLines(snapshot),
    "",
    ...buildTodayTaskLines(snapshot, today),
  ].join("\n");
}

export function buildTelegramTodayMessage(snapshot: AppSnapshot, today = isoToday()) {
  return [
    "Task fokus hari ini",
    formatDate(today),
    "",
    ...buildTodayTaskLines(snapshot, today).slice(1),
  ].join("\n");
}

export function buildTelegramDebtMessage(snapshot: AppSnapshot) {
  return [
    "Ringkasan cicilan",
    "",
    ...buildDebtLines(snapshot).slice(1),
  ].join("\n");
}

export function buildTelegramBudgetMessage(snapshot: AppSnapshot) {
  return [
    "Ringkasan budget",
    "",
    ...buildBudgetLines(snapshot).slice(1),
  ].join("\n");
}

export function buildTelegramHelpMessage() {
  return [
    "Perintah bot AIO Personal Tracker",
    "",
    "/start atau /help - daftar perintah",
    "/digest - ringkasan budget, cicilan, dan task",
    "/today - task fokus hari ini",
    "/debts - cicilan terlambat dan terdekat",
    "/budget - progress budget aktif",
    "/ping - cek bot aktif",
  ].join("\n");
}

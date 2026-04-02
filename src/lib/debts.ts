import type {
  AppSnapshot,
  Debt,
  DebtInstallment,
  DebtPayment,
  DebtStatus,
} from "@/lib/domain/models";
import { isoToday } from "@/lib/utils";

export function resolveAutomaticDebtStatus(dueOn: string): DebtStatus {
  const today = isoToday();

  if (dueOn < today) {
    return "overdue";
  }

  const daysUntilDue = Math.ceil(
    (new Date(dueOn).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilDue <= 7) {
    return "watch";
  }

  return "healthy";
}

export function getEffectiveInstallmentStatus(installment: DebtInstallment): DebtStatus {
  if (installment.statusSource === "manual") {
    return installment.status;
  }

  if (installment.paidOn) {
    return "paid";
  }

  return resolveAutomaticDebtStatus(installment.dueOn);
}

export function getInstallmentPaymentAmount(installment: DebtInstallment) {
  return installment.amount + installment.lateFeeAmount;
}

export function syncInstallmentStatuses(installments: DebtInstallment[]) {
  installments.forEach((installment) => {
    if (installment.statusSource === "auto") {
      installment.status = getEffectiveInstallmentStatus(installment);
    }
  });
}

export function recomputeDebtSummaries(
  debts: Debt[],
  installments: DebtInstallment[],
  payments: DebtPayment[],
) {
  syncInstallmentStatuses(installments);

  debts.forEach((debt) => {
    const debtInstallments = installments
      .filter((installment) => installment.debtId === debt.id)
      .sort((left, right) => left.installmentNumber - right.installmentNumber);
    const unpaidInstallments = debtInstallments.filter(
      (installment) => getEffectiveInstallmentStatus(installment) !== "paid",
    );

    debt.remainingAmount = unpaidInstallments.reduce(
      (sum, installment) => sum + getInstallmentPaymentAmount(installment),
      0,
    );
    debt.remainingMonths = unpaidInstallments.length;
    debt.totalMonths = debtInstallments.length;

    if (!debtInstallments.length || unpaidInstallments.length === 0) {
      debt.status = "paid";
      return;
    }

    if (unpaidInstallments.some((installment) => getEffectiveInstallmentStatus(installment) === "overdue")) {
      debt.status = "overdue";
      return;
    }

    if (unpaidInstallments.some((installment) => getEffectiveInstallmentStatus(installment) === "watch")) {
      debt.status = "watch";
      return;
    }

    debt.status = "healthy";

    const lastPayment = payments
      .filter((payment) => payment.debtId === debt.id)
      .sort((left, right) => right.paidOn.localeCompare(left.paidOn))[0];

    if (lastPayment?.remainingAmount === 0) {
      debt.status = "paid";
    }
  });
}

export function getOpenInstallments(snapshot: AppSnapshot) {
  return snapshot.debtInstallments
    .filter((installment) => getEffectiveInstallmentStatus(installment) !== "paid")
    .sort((left, right) => {
      const dueDiff = left.dueOn.localeCompare(right.dueOn);

      if (dueDiff !== 0) {
        return dueDiff;
      }

      const leftDebt = snapshot.debts.find((debt) => debt.id === left.debtId);
      const rightDebt = snapshot.debts.find((debt) => debt.id === right.debtId);

      return (leftDebt?.remainingAmount ?? 0) - (rightDebt?.remainingAmount ?? 0);
    });
}

export function getNearestInstallment(snapshot: AppSnapshot) {
  return getOpenInstallments(snapshot)[0];
}

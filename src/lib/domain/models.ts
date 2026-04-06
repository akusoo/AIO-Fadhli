export type NavigationKey =
  | "dashboard"
  | "finance"
  | "debts"
  | "tasks"
  | "projects"
  | "notes"
  | "wishlist"
  | "shopping";

export type TransactionKind = "income" | "expense" | "transfer";
export type CategoryKind = "income" | "expense";
export type AccountType = "cash" | "bank" | "e-wallet";
export type BudgetCycleStatus = "active" | "completed" | "planned";
export type InvestmentStatus = "active" | "paused" | "closed";
export type InvestmentInstrument =
  | "stock"
  | "fund"
  | "bond"
  | "crypto"
  | "gold"
  | "money-market"
  | "other";
export type DebtStatus = "healthy" | "watch" | "overdue" | "paid";
export type DebtStatusSource = "auto" | "manual";
export type TaskStatus = "todo" | "doing" | "done";
export type Priority = "low" | "medium" | "high";
export type ProjectStatus = "active" | "paused" | "done";
export type NoteLinkType = "task" | "project";
export type WishStatus = "wish" | "ready" | "moved";
export type ShoppingStatus = "planned" | "buying" | "bought";
export type ReminderCadence = "event-based" | "daily-digest";
export type RecurringCadence = "weekly" | "monthly" | "custom";
export type UpcomingFinanceType = "income" | "expense" | "debt_due";
export type TaskRecurringCadence = "daily" | "weekly" | "monthly";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  location: string;
};

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
};

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
};

export type BudgetCycle = {
  id: string;
  label: string;
  startOn: string;
  endOn: string;
  targetAmount: number;
  spentAmount: number;
  incomeAmount: number;
  status: BudgetCycleStatus;
};

export type Transaction = {
  id: string;
  title: string;
  kind: TransactionKind;
  amount: number;
  occurredOn: string;
  accountId: string;
  categoryId?: string;
  cycleId?: string;
  merchant?: string;
  tags?: string[];
  note?: string;
  transferTargetAccountId?: string;
  sourceType?: "shopping" | "debt_installment" | "investment";
  sourceId?: string;
};

export type Investment = {
  id: string;
  name: string;
  platform: string;
  instrument: InvestmentInstrument;
  status: InvestmentStatus;
  startDate: string;
  investedAmount: number;
  currentValue: number;
  accountId: string;
  categoryId?: string;
  tags?: string[];
  note?: string;
};

export type InvestmentValuation = {
  id: string;
  investmentId: string;
  valuedOn: string;
  currentValue: number;
  note?: string;
};

export type BudgetCategoryAllocation = {
  id: string;
  cycleId: string;
  categoryId: string;
  allocatedAmount: number;
};

export type RecurringPlan = {
  id: string;
  label: string;
  kind: "income" | "expense";
  amount: number;
  cadence: RecurringCadence;
  nextOccurrenceOn: string;
  accountId: string;
  categoryId?: string;
  merchant?: string;
  tags?: string[];
  note?: string;
  enabled: boolean;
};

export type UpcomingFinanceItem = {
  id: string;
  label: string;
  type: UpcomingFinanceType;
  amount: number;
  dueOn: string;
  source: "recurring" | "debt";
  detail: string;
};

export type CashflowPoint = {
  id: string;
  label: string;
  income: number;
  expense: number;
  net: number;
};

export type CategorySpendPoint = {
  categoryId: string;
  label: string;
  spentAmount: number;
  allocatedAmount?: number;
};

export type FinanceOverview = {
  availableCash: number;
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  activeCycleId?: string;
  activeCycleSpent?: number;
  activeCycleTarget?: number;
  upcomingTotal: number;
  upcomingCount: number;
};

export type Debt = {
  id: string;
  name: string;
  lender: string;
  principalAmount: number;
  remainingAmount: number;
  installmentAmount: number;
  totalMonths: number;
  remainingMonths: number;
  note?: string;
  status: DebtStatus;
};

export type DebtInstallment = {
  id: string;
  debtId: string;
  installmentNumber: number;
  dueOn: string;
  amount: number;
  lateFeeAmount: number;
  status: DebtStatus;
  statusSource: DebtStatusSource;
  paidOn?: string;
  note?: string;
};

export type DebtPayment = {
  id: string;
  debtId: string;
  installmentId: string;
  amount: number;
  paidOn: string;
  remainingAmount: number;
  note?: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  focus: string;
};

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueOn?: string;
  projectId?: string;
  todayPinned?: boolean;
  note?: string;
  startTime?: string;
  dueTime?: string;
  reminderAt?: string;
  completedAt?: string;
  recurring?: {
    cadence: TaskRecurringCadence;
    interval?: number;
  };
};

export type Subtask = {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  note?: string;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  links: NoteLink[];
};

export type NoteLink = {
  type: NoteLinkType;
  id: string;
};

export type WishItem = {
  id: string;
  name: string;
  targetPrice: number;
  priority: Priority;
  status: WishStatus;
  note?: string;
  sourceUrl?: string;
  imageUrl?: string;
};

export type ShoppingItem = {
  id: string;
  name: string;
  estimatedPrice: number;
  quantity: number;
  section: string;
  status: ShoppingStatus;
  store?: string;
  sourceWishId?: string;
  note?: string;
};

export type ReminderRule = {
  id: string;
  channel: "telegram";
  cadence: ReminderCadence;
  enabled: boolean;
  label: string;
};

export type DashboardCard = {
  id: string;
  title: string;
  value: string;
  detail: string;
  href: string;
  tone: "ink" | "mint" | "amber" | "rose";
};

export type AppSnapshot = {
  session: SessionUser;
  accounts: Account[];
  categories: Category[];
  budgetCycles: BudgetCycle[];
  budgetCategoryAllocations: BudgetCategoryAllocation[];
  transactions: Transaction[];
  investments: Investment[];
  investmentValuations: InvestmentValuation[];
  recurringPlans: RecurringPlan[];
  debts: Debt[];
  debtInstallments: DebtInstallment[];
  debtPayments: DebtPayment[];
  projects: Project[];
  tasks: Task[];
  subtasks: Subtask[];
  notes: Note[];
  wishItems: WishItem[];
  shoppingItems: ShoppingItem[];
  reminderRules: ReminderRule[];
};

export type AddTransactionInput = {
  title: string;
  kind: TransactionKind;
  amount: number;
  occurredOn: string;
  accountId: string;
  categoryId?: string;
  cycleId?: string;
  merchant?: string;
  tags?: string[];
  note?: string;
  transferTargetAccountId?: string;
  sourceType?: "shopping" | "debt_installment" | "investment";
  sourceId?: string;
};

export type UpdateTransactionInput = {
  transactionId: string;
  title: string;
  kind: TransactionKind;
  amount: number;
  occurredOn: string;
  accountId: string;
  categoryId?: string;
  cycleId?: string;
  merchant?: string;
  tags?: string[];
  note?: string;
  transferTargetAccountId?: string;
};

export type AddInvestmentInput = {
  name: string;
  platform: string;
  instrument: InvestmentInstrument;
  startDate: string;
  investedAmount: number;
  currentValue: number;
  accountId: string;
  categoryId?: string;
  tags?: string[];
  note?: string;
  syncToTransaction?: boolean;
};

export type UpdateInvestmentInput = {
  investmentId: string;
  name: string;
  platform: string;
  instrument: InvestmentInstrument;
  status: InvestmentStatus;
  accountId: string;
  categoryId?: string;
  tags?: string[];
  note?: string;
};

export type AddInvestmentValuationInput = {
  investmentId: string;
  valuedOn: string;
  currentValue: number;
  note?: string;
  syncToTransaction?: boolean;
};

export type AddAccountInput = {
  name: string;
  type: AccountType;
  balance: number;
};

export type AddCategoryInput = {
  name: string;
  kind: CategoryKind;
};

export type AddBudgetCycleInput = {
  label: string;
  startOn: string;
  endOn: string;
  targetAmount: number;
  status: BudgetCycleStatus;
};

export type UpdateBudgetCycleInput = {
  cycleId: string;
  label: string;
  startOn: string;
  endOn: string;
  targetAmount: number;
  status: BudgetCycleStatus;
};

export type AddRecurringPlanInput = {
  label: string;
  kind: "income" | "expense";
  amount: number;
  cadence: RecurringCadence;
  nextOccurrenceOn: string;
  accountId: string;
  categoryId?: string;
  merchant?: string;
  tags?: string[];
  note?: string;
};

export type PayDebtInput = {
  debtId: string;
  installmentId: string;
  amount: number;
  paidOn: string;
  note?: string;
};

export type UpdateDebtInstallmentStatusInput = {
  debtId: string;
  installmentId: string;
  status: DebtStatus;
  paidOn?: string;
  note?: string;
};

export type UpdateDebtInstallmentInput = {
  installmentId: string;
  dueOn: string;
  amount: number;
  lateFeeAmount: number;
  note?: string;
  paidOn?: string;
};

export type AddDebtInput = {
  name: string;
  lender: string;
  principalAmount: number;
  installmentAmount: number;
  totalMonths: number;
  firstDueOn: string;
  lateFeeAmount: number;
  note?: string;
  installments?: Array<{
    installmentNumber: number;
    dueOn: string;
    amount: number;
    lateFeeAmount: number;
    note?: string;
  }>;
};

export type AddTaskInput = {
  title: string;
  priority?: Priority;
  dueOn?: string;
  projectId?: string;
  todayPinned?: boolean;
  note?: string;
  startTime?: string;
  dueTime?: string;
  reminderAt?: string;
  recurring?: {
    cadence: TaskRecurringCadence;
    interval?: number;
  };
};

export type AddProjectInput = {
  name: string;
  focus: string;
  description: string;
};

export type UpdateTaskInput = {
  taskId: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueOn?: string;
  projectId?: string;
  todayPinned?: boolean;
  note?: string;
  startTime?: string;
  dueTime?: string;
  reminderAt?: string;
  recurring?: {
    cadence: TaskRecurringCadence;
    interval?: number;
  };
  completedAt?: string;
};

export type AddSubtaskInput = {
  taskId: string;
  title: string;
  note?: string;
};

export type UpdateSubtaskInput = {
  subtaskId: string;
  title: string;
  note?: string;
};

export type AddNoteInput = {
  title: string;
  content: string;
  links?: NoteLink[];
};

export type AddWishInput = {
  name: string;
  targetPrice: number;
  priority: Priority;
  note?: string;
  sourceUrl?: string;
  imageUrl?: string;
};

export type UpdateWishInput = {
  wishId: string;
  name: string;
  targetPrice: number;
  priority: Priority;
  note?: string;
  sourceUrl?: string;
  imageUrl?: string;
};

export type UpdateNoteInput = {
  noteId: string;
  title: string;
  content: string;
};

export type SetNoteLinksInput = {
  noteId: string;
  links: NoteLink[];
};

export type SetWishStatusInput = {
  wishId: string;
  status: WishStatus;
};

export type AddShoppingItemInput = {
  name: string;
  estimatedPrice: number;
  quantity: number;
  section: string;
  store?: string;
  note?: string;
};

export type UpdateShoppingItemInput = {
  itemId: string;
  name: string;
  estimatedPrice: number;
  quantity: number;
  section: string;
  store?: string;
  note?: string;
};

export type SetShoppingStatusInput = {
  itemId: string;
  status: ShoppingStatus;
};

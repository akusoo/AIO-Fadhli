import type {
  Account,
  AddDebtInput,
  AddNoteInput,
  AddProjectInput,
  AddRecurringPlanInput,
  AddShoppingItemInput,
  AddSubtaskInput,
  AddTaskInput,
  AddTransactionInput,
  AddWishInput,
  AppSnapshot,
  BudgetCategoryAllocation,
  BudgetCycle,
  CashflowPoint,
  Category,
  CategorySpendPoint,
  Debt,
  DebtPayment,
  FinanceOverview,
  Note,
  PayDebtInput,
  Project,
  RecurringPlan,
  ReminderRule,
  SetShoppingStatusInput,
  SetWishStatusInput,
  SessionUser,
  ShoppingItem,
  Subtask,
  Task,
  Transaction,
  UpdateDebtInstallmentInput,
  UpdateDebtInstallmentStatusInput,
  UpdateNoteInput,
  UpdateShoppingItemInput,
  UpdateSubtaskInput,
  SetNoteLinksInput,
  UpdateTaskInput,
  UpdateWishInput,
  UpcomingFinanceItem,
  WishItem,
} from "@/lib/domain/models";

export interface AuthService {
  getSession(): Promise<SessionUser | null>;
  signIn(email: string, password: string): Promise<SessionUser>;
  signOut(): Promise<void>;
}

export interface FinanceRepository {
  getBootSnapshot(): Promise<AppSnapshot>;
  listAccounts(): Promise<Account[]>;
  listCategories(): Promise<Category[]>;
  listBudgetCycles(): Promise<BudgetCycle[]>;
  listBudgetCategoryAllocations(): Promise<BudgetCategoryAllocation[]>;
  listTransactions(): Promise<Transaction[]>;
  addTransaction(input: AddTransactionInput): Promise<Transaction>;
  listRecurringPlans(): Promise<RecurringPlan[]>;
  addRecurringPlan(input: AddRecurringPlanInput): Promise<RecurringPlan>;
  getFinanceOverview(month?: string): Promise<FinanceOverview>;
  listUpcomingFinanceItems(): Promise<UpcomingFinanceItem[]>;
  getCashflowPoints(month?: string): Promise<CashflowPoint[]>;
  getCategorySpendPoints(
    month?: string,
    cycleId?: string,
  ): Promise<CategorySpendPoint[]>;
  listDebts(): Promise<Debt[]>;
  listDebtPayments(): Promise<DebtPayment[]>;
  payDebt(input: PayDebtInput): Promise<DebtPayment>;
  addDebt(input: AddDebtInput): Promise<void>;
  setDebtInstallmentStatus(input: UpdateDebtInstallmentStatusInput): Promise<void>;
  updateDebtInstallment(input: UpdateDebtInstallmentInput): Promise<void>;
}

export interface TaskRepository {
  getBootSnapshot(): Promise<AppSnapshot>;
  listTasks(): Promise<Task[]>;
  addTask(input: AddTaskInput): Promise<Task>;
  updateTask(input: UpdateTaskInput): Promise<Task>;
  moveTask(taskId: string, status: Task["status"]): Promise<Task>;
  toggleTodayPin(taskId: string): Promise<Task>;
  listSubtasks(): Promise<Subtask[]>;
  addSubtask(input: AddSubtaskInput): Promise<Subtask>;
  updateSubtask(input: UpdateSubtaskInput): Promise<Subtask>;
  toggleSubtask(subtaskId: string): Promise<Subtask>;
  listProjects(): Promise<Project[]>;
  addProject(input: AddProjectInput): Promise<Project>;
  listNotes(): Promise<Note[]>;
  addNote(input: AddNoteInput): Promise<Note>;
  updateNote(input: UpdateNoteInput): Promise<Note>;
  setNoteLinks(input: SetNoteLinksInput): Promise<Note>;
}

export interface WishlistRepository {
  listWishItems(): Promise<WishItem[]>;
  addWish(input: AddWishInput): Promise<WishItem>;
  updateWish(input: UpdateWishInput): Promise<WishItem>;
  deleteWish(wishId: string): Promise<void>;
  setWishStatus(input: SetWishStatusInput): Promise<WishItem>;
  moveWishToShopping(wishId: string): Promise<void>;
}

export interface ShoppingRepository {
  listShoppingItems(): Promise<ShoppingItem[]>;
  addShoppingItem(input: AddShoppingItemInput): Promise<ShoppingItem>;
  updateShoppingItem(input: UpdateShoppingItemInput): Promise<ShoppingItem>;
  deleteShoppingItem(itemId: string): Promise<void>;
  setShoppingStatus(input: SetShoppingStatusInput): Promise<ShoppingItem>;
  recordShoppingPurchase(itemId: string): Promise<void>;
}

export interface ReminderService {
  listRules(): Promise<ReminderRule[]>;
  previewDailyDigest(snapshot: AppSnapshot): Promise<string>;
}

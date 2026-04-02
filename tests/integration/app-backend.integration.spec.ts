import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  addDebtWithInstallments,
  buildAppSnapshot,
  createTransactionWithSideEffects,
  ensureUserBootstrap,
  moveWishToShoppingWithSideEffects,
  recordShoppingPurchaseWithSideEffects,
  replaceNoteLinks,
  updateDebtInstallmentStatusWithSideEffects,
} from "@/lib/server/app-backend";
import {
  cleanupUserData,
  createUserClient,
  deleteIntegrationUser,
  ensureIntegrationUser,
  hasIntegrationEnv,
  requireIntegrationEnvForCI,
} from "../support/supabase";

requireIntegrationEnvForCI();

const describeIfIntegration = hasIntegrationEnv() ? describe : describe.skip;

describeIfIntegration("app backend integration", () => {
  let primaryAdmin: Awaited<ReturnType<typeof ensureIntegrationUser>>["admin"];
  let primaryUser: Awaited<ReturnType<typeof createUserClient>>;
  let secondaryAdmin: Awaited<ReturnType<typeof ensureIntegrationUser>>["admin"];
  let secondaryUser: Awaited<ReturnType<typeof createUserClient>>;

  beforeAll(async () => {
    const primary = await ensureIntegrationUser("primary");
    const secondary = await ensureIntegrationUser("secondary");

    primaryAdmin = primary.admin;
    secondaryAdmin = secondary.admin;
    primaryUser = await createUserClient(primary.email, primary.password);
    secondaryUser = await createUserClient(secondary.email, secondary.password);
  });

  beforeEach(async () => {
    await cleanupUserData(primaryAdmin, primaryUser.user.id);
    await cleanupUserData(secondaryAdmin, secondaryUser.user.id);
  });

  it("bootstraps starter data idempotently and builds stable snapshots", async () => {
    await ensureUserBootstrap(primaryUser.client, primaryUser.user);
    await ensureUserBootstrap(primaryUser.client, primaryUser.user);

    const snapshotA = await buildAppSnapshot(primaryUser.client, primaryUser.user);
    const snapshotB = await buildAppSnapshot(primaryUser.client, primaryUser.user);

    expect(snapshotA.accounts.length).toBeGreaterThan(0);
    expect(snapshotA.categories.length).toBeGreaterThan(0);
    expect(snapshotA).toEqual(snapshotB);
  });

  it("persists transaction side effects into snapshot balances and cycle totals", async () => {
    await ensureUserBootstrap(primaryUser.client, primaryUser.user);
    const before = await buildAppSnapshot(primaryUser.client, primaryUser.user);
    const accountId = before.accounts[0]?.id;
    const cycleId = before.budgetCycles[0]?.id;
    const categoryId = before.categories.find((category) => category.kind === "expense")?.id;

    expect(accountId).toBeTruthy();
    expect(categoryId).toBeTruthy();

    await createTransactionWithSideEffects(primaryUser.client, primaryUser.user.id, {
      title: "Integration expense",
      kind: "expense",
      amount: 50_000,
      occurredOn: "2026-04-02",
      accountId: accountId as string,
      categoryId: categoryId as string,
      cycleId,
      tags: ["integration"],
    });

    const after = await buildAppSnapshot(primaryUser.client, primaryUser.user);
    const trackedAccount = after.accounts.find((account) => account.id === accountId);

    expect(after.transactions.some((transaction) => transaction.title === "Integration expense")).toBe(true);
    expect(trackedAccount?.balance).toBe((before.accounts[0]?.balance ?? 0) - 50_000);
  });

  it("keeps debt summaries, payments, and linked finance rows in sync", async () => {
    await ensureUserBootstrap(primaryUser.client, primaryUser.user);

    const debtId = await addDebtWithInstallments(primaryUser.client, primaryUser.user.id, {
      name: "Integration Debt",
      lender: "Teman",
      principalAmount: 600_000,
      installmentAmount: 200_000,
      totalMonths: 3,
      firstDueOn: "2026-04-02",
      lateFeeAmount: 10_000,
      note: "Debt integration",
    });

    let snapshot = await buildAppSnapshot(primaryUser.client, primaryUser.user);
    const targetInstallment = snapshot.debtInstallments.find((installment) => installment.debtId === debtId);

    expect(targetInstallment).toBeTruthy();

    await updateDebtInstallmentStatusWithSideEffects(primaryUser.client, primaryUser.user.id, {
      debtId,
      installmentId: targetInstallment?.id as string,
      status: "paid",
      paidOn: "2026-04-02",
      note: "Paid via integration test",
    });

    snapshot = await buildAppSnapshot(primaryUser.client, primaryUser.user);
    const payment = snapshot.debtPayments.find((entry) => entry.installmentId === targetInstallment?.id);

    expect(payment).toBeTruthy();
    expect(snapshot.transactions.some((transaction) => transaction.sourceId === targetInstallment?.id)).toBe(true);
  });

  it("supports note multi-link plus wishlist to shopping purchase deduplication", async () => {
    await ensureUserBootstrap(primaryUser.client, primaryUser.user);

    const projectId = "proj-integration";
    const taskId = "task-integration";
    const noteId = "note-integration";
    const wishId = "wish-integration";

    await primaryUser.client.from("projects").insert({
      id: projectId,
      user_id: primaryUser.user.id,
      name: "Project integration",
      description: "Project",
      status: "active",
      focus: "Testing",
    });
    await primaryUser.client.from("tasks").insert({
      id: taskId,
      user_id: primaryUser.user.id,
      title: "Task integration",
      status: "todo",
      priority: "medium",
    });
    await primaryUser.client.from("notes").insert({
      id: noteId,
      user_id: primaryUser.user.id,
      title: "Catatan integration",
      content: "Isi note",
    });

    await replaceNoteLinks(primaryUser.client, primaryUser.user.id, {
      noteId,
      links: [
        { type: "project", id: projectId },
        { type: "task", id: taskId },
      ],
    });

    await primaryUser.client.from("wish_items").insert({
      id: wishId,
      user_id: primaryUser.user.id,
      name: "Keyboard",
      target_price: 300_000,
      priority: "high",
      status: "ready",
    });

    await moveWishToShoppingWithSideEffects(primaryUser.client, primaryUser.user.id, wishId);

    let snapshot = await buildAppSnapshot(primaryUser.client, primaryUser.user);
    const shoppingItem = snapshot.shoppingItems.find((item) => item.sourceWishId === wishId);

    expect(snapshot.notes.find((note) => note.id === noteId)?.links).toHaveLength(2);
    expect(shoppingItem).toBeTruthy();

    await primaryUser.client
      .from("shopping_items")
      .update({ status: "bought" })
      .eq("id", shoppingItem?.id as string)
      .eq("user_id", primaryUser.user.id);

    await recordShoppingPurchaseWithSideEffects(
      primaryUser.client,
      primaryUser.user.id,
      shoppingItem?.id as string,
    );
    await recordShoppingPurchaseWithSideEffects(
      primaryUser.client,
      primaryUser.user.id,
      shoppingItem?.id as string,
    );

    snapshot = await buildAppSnapshot(primaryUser.client, primaryUser.user);
    const linkedTransactions = snapshot.transactions.filter(
      (transaction) => transaction.sourceType === "shopping" && transaction.sourceId === shoppingItem?.id,
    );

    expect(linkedTransactions).toHaveLength(1);
  });

  it("respects RLS boundaries between two test users", async () => {
    await ensureUserBootstrap(primaryUser.client, primaryUser.user);
    await ensureUserBootstrap(secondaryUser.client, secondaryUser.user);

    await createTransactionWithSideEffects(primaryUser.client, primaryUser.user.id, {
      title: "Only primary can see",
      kind: "expense",
      amount: 20_000,
      occurredOn: "2026-04-02",
      accountId: (await buildAppSnapshot(primaryUser.client, primaryUser.user)).accounts[0]?.id as string,
      categoryId: (await buildAppSnapshot(primaryUser.client, primaryUser.user)).categories.find(
        (category) => category.kind === "expense",
      )?.id as string,
    });

    const primarySnapshot = await buildAppSnapshot(primaryUser.client, primaryUser.user);
    const secondarySnapshot = await buildAppSnapshot(secondaryUser.client, secondaryUser.user);

    expect(primarySnapshot.transactions.some((transaction) => transaction.title === "Only primary can see")).toBe(true);
    expect(secondarySnapshot.transactions.some((transaction) => transaction.title === "Only primary can see")).toBe(false);
  });

  afterAll(async () => {
    await deleteIntegrationUser(primaryAdmin, primaryUser.user.id).catch(() => undefined);
    await deleteIntegrationUser(secondaryAdmin, secondaryUser.user.id).catch(() => undefined);
  });
});

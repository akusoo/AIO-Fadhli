import { expect, test } from "@playwright/test";
import { gotoAndAssert, loginAsE2EUser, resetTestData } from "./helpers";

function uniqueLabel(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}`;
}

test.describe("core workflows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsE2EUser(page);
    await resetTestData(page);
  });

  test("@smoke @regression quick capture task bisa dibuat lalu ditandai selesai", async ({ page }) => {
    const taskTitle = uniqueLabel("Quick Task");

    await gotoAndAssert(page, "/tasks", /Task sekarang jadi execution hub yang fokus ke Today/i);

    await page.getByTestId("quick-task-input-desktop").fill(taskTitle);
    await page.getByTestId("quick-task-submit-desktop").click();
    await page.getByRole("button", { name: /All tasks/i }).click();
    await page.getByPlaceholder("Cari task, project, atau catatan").fill(taskTitle);

    const taskCard = page.getByTestId(/task-card-/).filter({ hasText: taskTitle }).first();
    await expect(taskCard).toBeVisible();
    await taskCard.getByRole("button", { name: /^Selesai$/ }).click();

    await page.getByRole("button", { name: /Done/i }).click();
    await page.getByPlaceholder("Cari task, project, atau catatan").fill(taskTitle);
    await expect(page.getByTestId(/task-card-/).filter({ hasText: taskTitle }).first()).toBeVisible();
  });

  test("@regression project, task, dan note utama bisa dibuat dan dipakai lintas halaman", async ({ page }) => {
    const projectName = uniqueLabel("E2E Project");
    const taskTitle = uniqueLabel("E2E Task");
    const noteTitle = uniqueLabel("E2E Note");

    await gotoAndAssert(
      page,
      "/projects",
      /Projects sekarang jadi workspace yang lebih fokus dan tenang/i,
    );

    await page.getByRole("button", { name: /^Tambah project$/ }).click();
    await page.getByLabel("Nama project").fill(projectName);
    await page.getByLabel("Focus").fill("Verifikasi flow lintas modul");
    await page.getByLabel("Description").fill("Project khusus untuk suite end-to-end.");
    await page.getByRole("button", { name: "Simpan project" }).click();

    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

    await page.getByRole("button", { name: "Tambah task" }).click();
    await page.getByLabel("Judul task").fill(taskTitle);
    await page.getByLabel("Catatan task").fill("Task dari flow E2E projects.");
    await page.getByRole("button", { name: "Simpan task ke project" }).click();

    await expect(page.getByText(taskTitle)).toBeVisible();

    await gotoAndAssert(page, "/notes", /Notes sekarang jadi ruang capture lalu rapikan/i);

    await page.getByLabel("Judul note").fill(noteTitle);
    await page.getByRole("button", { name: "Tambah konteks opsional" }).click();
    await page.getByLabel("Konteks").selectOption("project");
    await page.getByLabel("Pilih project").selectOption({ label: projectName });
    await page.getByLabel("Isi note").fill("Catatan E2E yang terhubung ke project.");
    await page.getByRole("button", { name: "Simpan note" }).click();

    await expect(page.locator("p.text-lg", { hasText: noteTitle })).toBeVisible();

    await gotoAndAssert(page, "/tasks", /Task sekarang jadi execution hub yang fokus ke Today/i);
    await page.getByRole("button", { name: /All tasks/i }).click();
    await page.getByPlaceholder("Cari task, project, atau catatan").fill(taskTitle);

    const taskCard = page.getByTestId(/task-card-/).filter({ hasText: taskTitle }).first();
    await expect(taskCard).toBeVisible();
    await taskCard.getByRole("button", { name: /^Selesai$/ }).click();

    await page.getByRole("button", { name: /Done/i }).click();
    await page.getByPlaceholder("Cari task, project, atau catatan").fill(taskTitle);
    await expect(page.locator("p.mt-3.text-lg", { hasText: taskTitle })).toBeVisible();
  });

  test("@smoke @regression wishlist bisa naik ke shopping lalu dicatat ke finance", async ({ page }) => {
    const wishName = uniqueLabel("E2E Wish");

    await gotoAndAssert(
      page,
      "/wishlist",
      /Wishlist jadi ruang keputusan sebelum benar-benar belanja/i,
    );

    await page.getByLabel("Nama item").fill(wishName);
    await page.getByLabel("Target harga").fill("450000");
    await page.getByLabel("Prioritas").selectOption("high");
    await page.getByRole("button", { name: "Simpan wish" }).click();

    const wishlistRow = page.getByTestId(/wishlist-row-/).filter({
      has: page.getByText(wishName),
    }).first();

    await expect(wishlistRow).toBeVisible();
    await wishlistRow.getByRole("button", { name: "Tandai siap beli" }).click();

    const readyRow = page.getByTestId(/wishlist-row-/).filter({
      has: page.getByText(wishName),
    }).first();

    await readyRow.getByRole("button", { name: "Pindahkan ke shopping" }).click();

    await gotoAndAssert(
      page,
      "/shopping",
      /Belanja sekarang jadi list operasional yang lebih cepat dipakai/i,
    );

    let shoppingRow = page.getByTestId(/shopping-row-/).filter({
      has: page.getByText(wishName),
    }).first();

    await expect(shoppingRow).toBeVisible();
    await shoppingRow.getByRole("button", { name: "Mulai beli" }).click();

    shoppingRow = page.getByTestId(/shopping-row-/).filter({
      has: page.getByText(wishName),
    }).first();

    await shoppingRow.getByRole("button", { name: "Tandai sudah dibeli" }).click();

    const boughtRow = page.getByTestId(/shopping-row-/).filter({
      has: page.getByText(wishName),
    }).first();

    await boughtRow.getByRole("button", { name: "Catat ke finance" }).click();

    await gotoAndAssert(
      page,
      "/finance",
      /Finance yang lebih kaya, tetap terasa operasional/i,
    );

    await page.getByRole("button", { name: "Transactions" }).click();
    await expect(page.getByText(wishName)).toBeVisible();
  });

  test("@smoke @regression pinjaman baru muncul di debts dan dashboard", async ({ page }) => {
    const debtName = uniqueLabel("E2E Debt");
    const today = new Date().toISOString().slice(0, 10);

    await gotoAndAssert(page, "/debts", /Hutang sekarang dibaca per cicilan/i);

    await page.getByRole("button", { name: "Tambah pinjaman" }).click();
    await page.getByLabel("Nama pinjaman").fill(debtName);
    await page.getByLabel("Pemberi pinjaman").fill("Teman kantor");
    await page.getByLabel("Nominal total pinjaman").fill("600000");
    await page.getByLabel("Nominal cicilan per periode").fill("200000");
    await page.getByLabel("Tenor (bulan)").fill("3");
    await page.getByLabel("Jatuh tempo pertama").fill(today);
    await page.getByLabel("Biaya telat default per cicilan").fill("10000");
    await page.getByLabel("Catatan utama").fill("Hutang uji untuk flow E2E.");
    await page.getByRole("button", { name: "Simpan pinjaman" }).click();

    await expect(page.locator("p", { hasText: debtName }).last()).toBeVisible();

    await gotoAndAssert(
      page,
      "/dashboard",
      /Dashboard yang ringkas dan tenang/i,
    );

    await expect(page.getByText(new RegExp(`${debtName}.*cicilan`, "i")).first()).toBeVisible();
  });

  test("@smoke @regression @investments investasi bisa dibuat, diupdate, dan valuasinya sinkron ke transaksi", async ({ page }) => {
    const investmentName = uniqueLabel("E2E Invest");

    await gotoAndAssert(
      page,
      "/finance",
      /Finance yang lebih kaya, tetap terasa operasional/i,
    );

    await page.getByRole("button", { name: "Investments" }).click();

    await page.getByLabel("Nama investasi").fill(investmentName);
    await page.getByLabel("Platform").fill("Stockbit");
    await page.getByLabel("Instrumen").selectOption("stock");
    await page.getByLabel("Tanggal mulai").fill("2026-04-01");
    await page.getByRole("textbox", { name: /^Modal awal$/ }).fill("1000000");
    await page.getByRole("textbox", { name: /^Nilai saat ini$/ }).first().fill("1020000");
    await page.getByLabel("Akun pembayaran modal").selectOption({ index: 0 });
    await page.getByLabel("Tags (opsional)").fill("e2e,investasi");
    await page.getByLabel("Catatan").first().fill("Create investment from e2e flow");
    await page.getByRole("checkbox", { name: /Catat modal awal sebagai transaksi transfer ke akun investasi/i }).check();
    await page.getByRole("button", { name: /Simpan investasi/i }).click();

    const investmentRow = page.getByTestId(/investment-row-/).filter({ hasText: investmentName }).first();
    await expect(investmentRow).toBeVisible();

    await investmentRow.getByRole("button", { name: /^Edit$/ }).click();
    await page.getByLabel("Platform").fill("Bibit");
    await page.getByLabel("Status").selectOption("paused");
    await page.getByRole("button", { name: /Update investasi/i }).click();
    await expect(page.getByText(/Investasi berhasil diperbarui/i)).toBeVisible();

    await page.getByTestId("investment-valuation-select").selectOption({ index: 0 });
    await page.getByLabel("Tanggal valuasi").fill("2026-04-02");
    await page.getByTestId("investment-valuation-current-value").fill("1050000");
    await page.getByTestId("investment-valuation-note").fill("Valuasi naik setelah update");
    await page
      .getByRole("checkbox", { name: /Sinkron delta valuasi ke transaksi finance/i })
      .check();
    await page.getByRole("button", { name: /Simpan valuasi/i }).click();

    await page.getByRole("button", { name: "Transactions" }).click();
    await expect(page.getByText(new RegExp(`Investasi awal.*${investmentName}`, "i"))).toBeVisible();
  });
});

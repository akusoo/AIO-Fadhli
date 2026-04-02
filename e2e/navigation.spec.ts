import { test } from "@playwright/test";
import { gotoAndAssert, loginAsE2EUser, resetTestData } from "./helpers";

test.describe("workspace navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsE2EUser(page);
    await resetTestData(page);
  });

  test("@smoke @regression memuat semua halaman utama", async ({ page }) => {
    const pages = [
      {
        path: "/dashboard",
        heading: /Dashboard yang ringkas dan tenang/i,
      },
      {
        path: "/finance",
        heading: /Finance yang lebih kaya, tetap terasa operasional/i,
      },
      {
        path: "/debts",
        heading: /Hutang sekarang dibaca per cicilan, bukan hanya per akun/i,
      },
      {
        path: "/tasks",
        heading: /Task sekarang jadi execution hub yang fokus ke Today/i,
      },
      {
        path: "/projects",
        heading: /Projects sekarang jadi workspace yang lebih fokus dan tenang/i,
      },
      {
        path: "/notes",
        heading: /Notes sekarang jadi ruang capture lalu rapikan/i,
      },
      {
        path: "/wishlist",
        heading: /Wishlist jadi ruang keputusan sebelum benar-benar belanja/i,
      },
      {
        path: "/shopping",
        heading: /Belanja sekarang jadi list operasional yang lebih cepat dipakai/i,
      },
    ] as const;

    for (const pageConfig of pages) {
      await gotoAndAssert(page, pageConfig.path, pageConfig.heading);
    }
  });
});

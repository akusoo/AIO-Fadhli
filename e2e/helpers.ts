import { expect, type Page } from "@playwright/test";

function getE2ESecret() {
  return process.env.E2E_TEST_SECRET ?? "aio-local-e2e";
}

export async function loginAsE2EUser(page: Page) {
  await page.goto(`/api/test/auth/login?secret=${encodeURIComponent(getE2ESecret())}&next=/dashboard`);
  await page.waitForURL("**/dashboard");
  await expectPageHeading(
    page,
    /Halaman masuk yang ringkas untuk melihat apa yang perlu perhatian/i,
  );
}

export async function resetTestData(page: Page) {
  const result = await page.evaluate(async (secret) => {
    const response = await fetch("/api/test/reset", {
      method: "POST",
      headers: {
        "x-e2e-secret": secret,
      },
    });

    return {
      status: response.status,
      body: await response.text(),
    };
  }, getE2ESecret());

  expect(result.status, result.body).toBe(200);
}

export async function expectPageHeading(page: Page, heading: string | RegExp) {
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
}

export async function gotoAndAssert(page: Page, path: string, heading: string | RegExp) {
  await page.goto(path);
  await expectPageHeading(page, heading);
}

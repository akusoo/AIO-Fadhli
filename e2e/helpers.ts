import { expect, type Page } from "@playwright/test";

function getE2ESecret() {
  return process.env.E2E_TEST_SECRET ?? "aio-local-e2e";
}

function getTestRunId() {
  return process.env.TEST_RUN_ID ?? "local";
}

export async function loginAsE2EUser(page: Page) {
  await page.goto(
    `/api/test/auth/login?secret=${encodeURIComponent(getE2ESecret())}&runId=${encodeURIComponent(getTestRunId())}&next=/dashboard`,
  );
  await page.waitForURL("**/dashboard");
  await expectPageHeading(
    page,
    /Dashboard yang ringkas dan tenang/i,
  );
}

export async function resetTestData(page: Page) {
  const secret = getE2ESecret();
  const runId = getTestRunId();
  const response = await page.context().request.post(
    `/api/test/reset?secret=${encodeURIComponent(secret)}&runId=${encodeURIComponent(runId)}`,
    {
      headers: {
        "x-e2e-secret": secret,
        "x-test-run-id": runId,
      },
    },
  );

  const result = {
    status: response.status(),
    body: await response.text(),
  };

  expect(result.status, result.body).toBe(200);
}

export async function expectPageHeading(page: Page, heading: string | RegExp) {
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
}

export async function gotoAndAssert(page: Page, path: string, heading: string | RegExp) {
  await page.goto(path);
  await expectPageHeading(page, heading);
}

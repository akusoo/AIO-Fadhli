import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

function loadLocalEnvFile(filename: string) {
  const filepath = path.join(process.cwd(), filename);

  if (!fs.existsSync(filepath)) {
    return;
  }

  const content = fs.readFileSync(filepath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const unquoted =
      rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1)
        : rawValue.startsWith("'") && rawValue.endsWith("'")
          ? rawValue.slice(1, -1)
          : rawValue;

    process.env[key] = unquoted;
  }
}

loadLocalEnvFile(".env.test.local");
loadLocalEnvFile(".env.test");
loadLocalEnvFile(".env.local");
loadLocalEnvFile(".env");

const port = Number(process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? 3100);
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? `http://localhost:${port}`;
const useExternalBaseURL = Boolean(externalBaseURL);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: Number(process.env.PLAYWRIGHT_RETRIES ?? (process.env.CI ? 2 : 0)),
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: useExternalBaseURL
    ? undefined
    : {
        command: `pnpm exec next build && pnpm exec next start --port ${port}`,
        url: `${baseURL}/auth/sign-in`,
        reuseExistingServer: false,
        timeout: 240_000,
        env: {
          ...process.env,
          ENABLE_E2E_TEST_ROUTES: "true",
        },
      },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});

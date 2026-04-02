import fs from "node:fs/promises";
import path from "node:path";
import { test as setup } from "@playwright/test";
import { loginAsE2EUser } from "./helpers";

const authFile = path.join("playwright", ".auth", "user.json");

setup("login as e2e user", async ({ page }) => {
  await loginAsE2EUser(page);

  await fs.mkdir(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});

import { defineConfig, mergeConfig } from "vitest/config";
import { createSharedVitestConfig } from "./vitest.shared";

export default mergeConfig(
  createSharedVitestConfig(),
  defineConfig({
    test: {
      name: "unit",
      environment: "node",
      setupFiles: ["./tests/setup/node.ts"],
      include: ["tests/unit/**/*.spec.ts"],
      coverage: {
        include: [
          "src/lib/tasks.ts",
          "src/lib/debts.ts",
          "src/lib/finance.ts",
          "src/lib/utils.ts",
          "src/lib/reminders/telegram.ts",
          "src/lib/server/wishlist-link-preview.ts",
        ],
      },
    },
  }),
);

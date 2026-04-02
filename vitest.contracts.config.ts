import { defineConfig, mergeConfig } from "vitest/config";
import { createSharedVitestConfig } from "./vitest.shared";

export default mergeConfig(
  createSharedVitestConfig(),
  defineConfig({
    test: {
      name: "contracts",
      environment: "node",
      setupFiles: ["./tests/setup/node.ts"],
      include: ["tests/contracts/**/*.spec.ts"],
      coverage: {
        include: [
          "src/app/api/app/boot/route.ts",
          "src/app/api/tasks/route.ts",
          "src/app/api/finance/transactions/route.ts",
          "src/app/api/test/auth/login/route.ts",
          "src/app/api/test/reset/route.ts",
          "src/lib/server/e2e.ts",
          "src/lib/server/routes.ts",
        ],
      },
    },
  }),
);

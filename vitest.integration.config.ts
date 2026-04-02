import { defineConfig, mergeConfig } from "vitest/config";
import { createSharedVitestConfig } from "./vitest.shared";

export default mergeConfig(
  createSharedVitestConfig(),
  defineConfig({
    test: {
      name: "integration",
      environment: "node",
      setupFiles: ["./tests/setup/node.ts"],
      include: ["tests/integration/**/*.spec.ts"],
      testTimeout: 120_000,
      hookTimeout: 120_000,
      coverage: {
        include: ["src/lib/server/app-backend.ts"],
      },
    },
  }),
);

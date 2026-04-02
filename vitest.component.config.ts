import { defineConfig, mergeConfig } from "vitest/config";
import { createSharedVitestConfig } from "./vitest.shared";

export default mergeConfig(
  createSharedVitestConfig(),
  defineConfig({
    test: {
      name: "component",
      environment: "jsdom",
      setupFiles: ["./tests/setup/jsdom.ts"],
      include: ["tests/component/**/*.spec.ts?(x)"],
      coverage: {
        include: ["src/providers/app-state-provider.tsx"],
      },
    },
  }),
);

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(new URL(import.meta.url)));

function loadEnvFile(filename: string) {
  const filepath = path.join(rootDir, filename);

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

loadEnvFile(".env.test.local");
loadEnvFile(".env.test");
loadEnvFile(".env.local");
loadEnvFile(".env");

export function createSharedVitestConfig() {
  const coverageDirectory = process.env.VITEST_COVERAGE_DIR ?? "test-results/vitest/coverage";
  const junitFile = process.env.VITEST_JUNIT_FILE ?? "test-results/vitest/junit.xml";

  return {
    resolve: {
      alias: {
        "@": path.join(rootDir, "src"),
      },
    },
    test: {
      globals: false,
      reporters: process.env.CI ? ["default", "junit"] : ["default"],
      outputFile: process.env.CI ? { junit: junitFile } : undefined,
      coverage: {
        provider: "v8",
        reporter: process.env.CI ? ["text", "lcov", "html"] : ["text", "html"],
        reportsDirectory: coverageDirectory,
        thresholds: {
          lines: 80,
          functions: 80,
          statements: 80,
          branches: 70,
        },
      },
    },
  };
}

import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

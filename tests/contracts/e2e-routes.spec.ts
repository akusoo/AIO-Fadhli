import { afterEach, describe, expect, it, vi } from "vitest";

describe("test-only e2e routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 when test routes are disabled", async () => {
    vi.stubEnv("ENABLE_E2E_TEST_ROUTES", "false");
    const { GET } = await import("@/app/api/test/auth/login/route");

    const response = await GET(new Request("http://localhost/api/test/auth/login"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("returns 401 when secret is invalid", async () => {
    vi.stubEnv("ENABLE_E2E_TEST_ROUTES", "true");
    vi.stubEnv("E2E_TEST_SECRET", "correct-secret");
    const { POST } = await import("@/app/api/test/reset/route");

    const response = await POST(
      new Request("http://localhost/api/test/reset", {
        method: "POST",
        headers: {
          "x-e2e-secret": "wrong-secret",
        },
      }),
    );
    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});

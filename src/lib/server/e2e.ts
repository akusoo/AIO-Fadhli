import { NextResponse } from "next/server";
import { createSupabaseAdmin, hasSupabaseAdminEnv } from "@/lib/services/supabase-admin";

const E2E_AUTH_RETRY_MAX_ATTEMPTS = 4;
const E2E_AUTH_RETRY_DELAY_MS = 500;

function raiseIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryE2EAuthOperation<T>(operation: () => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 0; attempt < E2E_AUTH_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === E2E_AUTH_RETRY_MAX_ATTEMPTS - 1) {
        throw error;
      }

      await wait(E2E_AUTH_RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError;
}

function sanitizeRunId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 24) || "local";
}

export function getE2ETestRunId(request?: Request) {
  if (request) {
    const url = new URL(request.url);
    const fromRequest = url.searchParams.get("runId") ?? request.headers.get("x-test-run-id");

    if (fromRequest) {
      return sanitizeRunId(fromRequest);
    }
  }

  return sanitizeRunId(
    process.env.TEST_RUN_ID ??
      process.env.GITHUB_RUN_ID ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      "local",
  );
}

export function isE2ETestRoutesEnabled() {
  return process.env.ENABLE_E2E_TEST_ROUTES === "true";
}

export function guardE2ERoute(request: Request) {
  if (!isE2ETestRoutesEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const secret = process.env.E2E_TEST_SECRET ?? "aio-local-e2e";
  const url = new URL(request.url);
  const providedSecret = url.searchParams.get("secret") ?? request.headers.get("x-e2e-secret");

  if (providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function getE2ETestCredentials(runId = getE2ETestRunId()) {
  const email = process.env.E2E_TEST_EMAIL ?? `e2e+aio-${runId}@example.com`;
  const password = process.env.E2E_TEST_PASSWORD ?? "AioLocalE2E!234";

  return { email, password };
}

export async function ensureE2ETestUser(runId?: string) {
  if (!hasSupabaseAdminEnv()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum diset. Env ini dibutuhkan untuk menyiapkan user test Playwright.",
    );
  }

  const admin = createSupabaseAdmin();
  const { email, password } = getE2ETestCredentials(runId);
  const { error: createError } = await retryE2EAuthOperation(() =>
    admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: "E2E Test User",
      },
    }),
  );

  if (
    createError &&
    !createError.message.toLowerCase().includes("already") &&
    !createError.message.toLowerCase().includes("registered") &&
    !createError.message.toLowerCase().includes("exists")
  ) {
    raiseIfError(createError);
  }

  return { email, password };
}

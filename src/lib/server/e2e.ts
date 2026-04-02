import { NextResponse } from "next/server";
import { createSupabaseAdmin, hasSupabaseAdminEnv } from "@/lib/services/supabase-admin";

function raiseIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
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
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  raiseIfError(error);

  const existingUser = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

  if (!existingUser) {
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: "E2E Test User",
      },
    });

    raiseIfError(createError);
    return { email, password };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, {
    password,
    email_confirm: true,
    user_metadata: {
      ...existingUser.user_metadata,
      name: "E2E Test User",
    },
  });

  raiseIfError(updateError);
  return { email, password };
}

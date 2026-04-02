import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

const RESET_TABLES = [
  "debt_payments",
  "debt_installments",
  "debts",
  "subtasks",
  "tasks",
  "projects",
  "note_links",
  "notes",
  "shopping_items",
  "wish_items",
  "transactions",
  "recurring_plans",
  "budget_category_allocations",
  "budget_cycles",
  "reminder_rules",
  "categories",
  "accounts",
] as const;
const SUPABASE_AUTH_RETRY_MAX_ATTEMPTS = 4;
const SUPABASE_AUTH_RETRY_DELAY_MS = 500;

type IntegrationEnv = {
  anonKey: string;
  serviceRoleKey: string;
  url: string;
};

function sanitizeRunId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 32) || "local";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retrySupabaseOperation<T>(operation: () => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 0; attempt < SUPABASE_AUTH_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === SUPABASE_AUTH_RETRY_MAX_ATTEMPTS - 1) {
        throw error;
      }

      await wait(SUPABASE_AUTH_RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError;
}

function getIntegrationEnv(): IntegrationEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    return null;
  }

  return {
    url,
    anonKey,
    serviceRoleKey,
  };
}

export function hasIntegrationEnv() {
  return getIntegrationEnv() !== null;
}

export function getAdminSupabase() {
  const env = getIntegrationEnv();

  if (!env) {
    throw new Error("Supabase integration env belum lengkap.");
  }

  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function ensureIntegrationUser(label: string) {
  const env = getIntegrationEnv();

  if (!env) {
    throw new Error("Supabase integration env belum lengkap.");
  }

  const runId = sanitizeRunId(process.env.TEST_RUN_ID ?? "local");
  const normalizedLabel = sanitizeRunId(label);
  const email = `integration+${normalizedLabel}-${runId}@example.com`;
  const password = `AioIntegration!${runId.slice(0, 8) || "local"}`;
  const admin = getAdminSupabase();
  try {
    const existingUser = await createUserClient(email, password);

    return {
      admin,
      email,
      password,
      user: existingUser.user,
    };
  } catch {
    const { data, error } = await retrySupabaseOperation(() =>
      admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: `Integration ${normalizedLabel}`,
        },
      }),
    );

    if (error || !data.user) {
      throw error ?? new Error("Gagal membuat user integration.");
    }
  }

  const createdUser = await createUserClient(email, password);

  return {
    admin,
    email,
    password,
    user: createdUser.user,
  };
}

export async function createUserClient(email: string, password: string) {
  const env = getIntegrationEnv();

  if (!env) {
    throw new Error("Supabase integration env belum lengkap.");
  }

  const client = createClient(env.url, env.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await retrySupabaseOperation(() =>
    client.auth.signInWithPassword({ email, password }),
  );

  if (error) {
    throw error;
  }

  const {
    data: { user },
    error: userError,
  } = await retrySupabaseOperation(() => client.auth.getUser());

  if (userError || !user) {
    throw userError ?? new Error("Gagal membaca user integration.");
  }

  return {
    client,
    user,
  };
}

export async function cleanupUserData(admin: SupabaseClient, userId: string) {
  for (const table of RESET_TABLES) {
    const { error } = await retrySupabaseOperation(async () =>
      await admin.from(table).delete().eq("user_id", userId),
    );

    if (error) {
      throw error;
    }
  }

  const { error } = await retrySupabaseOperation(async () =>
    await admin.from("profiles").delete().eq("id", userId),
  );

  if (error) {
    throw error;
  }
}

export async function deleteIntegrationUser(admin: SupabaseClient, userId: string) {
  await cleanupUserData(admin, userId).catch(() => undefined);
  const { error } = await retrySupabaseOperation(() => admin.auth.admin.deleteUser(userId));

  if (error) {
    throw error;
  }
}

export function requireIntegrationEnvForCI() {
  if (!process.env.CI) {
    return;
  }

  if (!hasIntegrationEnv()) {
    throw new Error("CI integration suite butuh env Supabase test project.");
  }
}

export function assertUser(user: User | null): User {
  if (!user) {
    throw new Error("User integration tidak tersedia.");
  }

  return user;
}

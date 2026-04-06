import { buildAppSnapshot, ensureUserBootstrap } from "@/lib/server/app-backend";
import { guardE2ERoute } from "@/lib/server/e2e";
import { getAuthedRouteContext, okJson } from "@/lib/server/routes";

const RESET_TABLES = [
  "investment_valuations",
  "investments",
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

function raiseIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function POST(request: Request) {
  const guard = guardE2ERoute(request);

  if (guard) {
    return guard;
  }

  const context = await getAuthedRouteContext();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, user, applyCookies } = context;

  for (const table of RESET_TABLES) {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id);
    raiseIfError(error);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      name: "E2E Test User",
      email: user.email ?? "e2e@example.com",
      location: "Jakarta",
    })
    .eq("id", user.id);

  raiseIfError(profileError);

  await ensureUserBootstrap(supabase, user);
  const snapshot = await buildAppSnapshot(supabase, user);

  return okJson({ ok: true, snapshot }, applyCookies);
}

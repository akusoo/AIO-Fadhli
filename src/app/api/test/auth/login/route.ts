import { NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/services/supabase-server";
import {
  ensureE2ETestUser,
  getE2ETestCredentials,
  getE2ETestRunId,
  guardE2ERoute,
  retryE2EAuthOperation,
} from "@/lib/server/e2e";

export async function GET(request: Request) {
  const guard = guardE2ERoute(request);

  if (guard) {
    return guard;
  }

  const runId = getE2ETestRunId(request);
  const url = new URL(request.url);
  const nextPath = url.searchParams.get("next") ?? "/dashboard";
  const { email, password } = getE2ETestCredentials(runId);
  const { supabase, applyCookies } = await createSupabaseRouteHandlerClient();

  await supabase.auth.signOut();

  let { error } = await retryE2EAuthOperation(() =>
    supabase.auth.signInWithPassword({
      email,
      password,
    }),
  );

  if (error) {
    await ensureE2ETestUser(runId);

    ({ error } = await retryE2EAuthOperation(() =>
      supabase.auth.signInWithPassword({
        email,
        password,
      }),
    ));
  }

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.redirect(new URL(nextPath, url.origin));
  applyCookies(response);
  return response;
}

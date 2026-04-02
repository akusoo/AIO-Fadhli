import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/services/supabase-env";
import { createSupabaseRouteHandlerClient } from "@/lib/services/supabase-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = url.searchParams.get("next") ?? "/dashboard";

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(new URL("/auth/sign-in", url.origin));
  }

  const { supabase, applyCookies } = await createSupabaseRouteHandlerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const response = NextResponse.redirect(new URL("/auth/sign-in", url.origin));
      applyCookies(response);
      return response;
    }
  }

  const response = NextResponse.redirect(new URL(nextPath, url.origin));
  applyCookies(response);
  return response;
}

import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/services/supabase-env";
import { createSupabaseRouteHandlerClient } from "@/lib/services/supabase-server";

export async function POST(request: Request) {
  const url = new URL(request.url);

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(new URL("/auth/sign-in", url.origin));
  }

  const { supabase, applyCookies } = await createSupabaseRouteHandlerClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL("/auth/sign-in", url.origin), 303);
  applyCookies(response);
  return response;
}

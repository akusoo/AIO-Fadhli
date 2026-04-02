import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/services/supabase-env";
import { createSupabaseRouteHandlerClient } from "@/lib/services/supabase-server";
import { ensureUserBootstrap } from "@/lib/server/app-backend";

export type RouteParamsContext<TKey extends string> = {
  params: Promise<Record<TKey, string>>;
};

export async function getAuthedRouteContext() {
  if (!hasSupabaseEnv()) {
    return {
      error: NextResponse.json(
        { error: "Supabase belum dikonfigurasi di environment." },
        { status: 503 },
      ),
    } as const;
  }

  const { supabase, applyCookies } = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    applyCookies(response);
    return { error: response } as const;
  }

  await ensureUserBootstrap(supabase, user);

  return {
    supabase,
    user,
    applyCookies,
  } as const;
}

export function okJson(
  data: unknown,
  applyCookies?: (response: NextResponse) => void,
  init?: ResponseInit,
) {
  const response = NextResponse.json(data, init);
  applyCookies?.(response);
  return response;
}

export function errorJson(
  message: string,
  status = 500,
  applyCookies?: (response: NextResponse) => void,
) {
  const response = NextResponse.json({ error: message }, { status });
  applyCookies?.(response);
  return response;
}

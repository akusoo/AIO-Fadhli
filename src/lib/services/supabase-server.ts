import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  createServerClient,
  type CookieOptionsWithName,
} from "@supabase/ssr";
import { getSupabaseEnv, hasSupabaseEnv } from "@/lib/services/supabase-env";

type PendingCookie = {
  name: string;
  value: string;
  options?: CookieOptionsWithName;
};

export async function createSupabaseServerComponentClient() {
  const { url, key } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });
}

export async function createSupabaseRouteHandlerClient() {
  const { url, key } = getSupabaseEnv();
  const cookieStore = await cookies();
  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pendingCookies.push({ name, value, options });
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  function applyCookies(response: NextResponse) {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
  }

  return { supabase, applyCookies };
}

export async function updateSupabaseSession(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.next();
  }

  const { url, key } = getSupabaseEnv();
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

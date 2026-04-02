import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/services/supabase-env";

export function hasSupabaseAdminEnv() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createSupabaseAdmin() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum diset. Env ini dibutuhkan untuk helper E2E auth.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/services/supabase-env";

export function createSupabaseBrowser() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient(url, key);
}

import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/services/supabase-env";
import { createSupabaseServerComponentClient } from "@/lib/services/supabase-server";

export default async function Home() {
  if (!hasSupabaseEnv()) {
    redirect("/auth/sign-in");
  }

  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/auth/sign-in");
}

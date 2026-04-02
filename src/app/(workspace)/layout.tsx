import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { hasSupabaseEnv } from "@/lib/services/supabase-env";
import { createSupabaseServerComponentClient } from "@/lib/services/supabase-server";

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  if (!hasSupabaseEnv()) {
    redirect("/auth/sign-in");
  }

  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  return <AppShell>{children}</AppShell>;
}

import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { SignInForm } from "@/app/auth/sign-in/sign-in-form";
import { hasSupabaseEnv } from "@/lib/services/supabase-env";
import { createSupabaseServerComponentClient } from "@/lib/services/supabase-server";

export default async function SignInPage() {
  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerComponentClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <PageHeader
          actions={undefined}
          description="Backend production memakai auth dan database sungguhan. Masuk dulu untuk mulai memakai data pribadi Anda."
          eyebrow="Authentication"
          title="AIO Personal Tracker"
        />

        {!hasSupabaseEnv() ? (
          <div className="max-w-lg rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-sm)]">
            <p className="text-base font-semibold text-[var(--foreground)]">
              Supabase env belum siap
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Isi `.env.local` dengan `NEXT_PUBLIC_SUPABASE_URL` dan
              `NEXT_PUBLIC_SUPABASE_ANON_KEY`, lalu jalankan ulang aplikasi.
            </p>
          </div>
        ) : (
          <SignInForm />
        )}
      </div>
    </main>
  );
}

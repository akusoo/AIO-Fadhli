import { PageHeader } from "@/components/ui";
import { ResetPasswordForm } from "@/app/auth/reset-password/reset-password-form";
import { hasSupabaseEnv } from "@/lib/services/supabase-env";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-transparent px-4 py-10 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <PageHeader
          actions={undefined}
          description="Halaman ini dipakai setelah Anda membuka link recovery dari email."
          eyebrow="Authentication"
          title="Set Password Baru"
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
          <ResetPasswordForm />
        )}
      </div>
    </main>
  );
}

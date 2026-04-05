"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ActionButton, Input, SectionCard } from "@/components/ui";
import { hasSupabaseEnv } from "@/lib/services/supabase-env";
import { createSupabaseBrowser } from "@/lib/services/supabase";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isConfigured = useMemo(() => hasSupabaseEnv(), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isConfigured) {
      setFeedback("Supabase env belum siap. Lengkapi .env.local terlebih dulu.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      });

      if (error) {
        throw error;
      }

      setFeedback(
        "Link reset password sudah dikirim. Buka email Anda, lalu lanjutkan dari link tersebut untuk membuat password baru.",
      );
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Gagal mengirim email reset password.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SectionCard
      className="max-w-lg"
      description="Khusus untuk akun lama yang dulu masuk lewat magic link atau akun yang belum punya password."
      title="Buat password akun lama"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">Kirim link reset</p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Link ini akan membawa Anda ke halaman untuk membuat password baru.
          </p>
        </div>

        <label className="block space-y-2 text-sm">
          <span className="font-medium text-[var(--foreground)]">Email</span>
          <Input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nama@email.com"
            required
            type="email"
            value={email}
          />
        </label>

        {feedback ? (
          <p className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
            {feedback}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <ActionButton type="submit">
            {isSubmitting ? "Mengirim..." : "Kirim link reset"}
          </ActionButton>
          <ActionButton href="/auth/sign-in" variant="ghost">
            Kembali ke login
          </ActionButton>
        </div>
      </form>
    </SectionCard>
  );
}

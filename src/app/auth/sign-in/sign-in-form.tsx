"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ActionButton, Input, SectionCard } from "@/components/ui";
import { hasSupabaseEnv } from "@/lib/services/supabase-env";
import { createSupabaseBrowser } from "@/lib/services/supabase";

export function SignInForm() {
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
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      setFeedback("Magic link sudah dikirim. Cek email Anda lalu lanjutkan ke aplikasi.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal mengirim magic link.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SectionCard
      className="max-w-lg"
      description="Masuk dengan magic link agar backend, sesi, dan data pribadi bergerak lewat Supabase."
      title="Masuk ke AIO Tracker"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
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
            {isSubmitting ? "Mengirim..." : "Kirim magic link"}
          </ActionButton>
        </div>
      </form>
    </SectionCard>
  );
}

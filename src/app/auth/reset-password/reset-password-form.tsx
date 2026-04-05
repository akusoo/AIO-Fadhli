"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ActionButton, Input, SectionCard } from "@/components/ui";
import { hasSupabaseEnv } from "@/lib/services/supabase-env";
import { createSupabaseBrowser } from "@/lib/services/supabase";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const isConfigured = useMemo(() => hasSupabaseEnv(), []);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      if (!isConfigured) {
        return;
      }

      const supabase = createSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (isMounted) {
        setHasRecoverySession(Boolean(user));
      }
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, [isConfigured]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isConfigured) {
      setFeedback("Supabase env belum siap. Lengkapi .env.local terlebih dulu.");
      return;
    }

    if (password.length < 8) {
      setFeedback("Password minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setFeedback("Konfirmasi password belum sama.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      window.location.assign("/dashboard");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal memperbarui password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SectionCard
      className="max-w-lg"
      description="Masukkan password baru untuk akun Anda. Setelah berhasil, Anda bisa login normal dengan email dan password."
      title="Buat password baru"
    >
      {!hasRecoverySession ? (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--muted)]">
            Sesi recovery belum ditemukan. Buka ulang link reset dari email terbaru Anda, lalu
            lanjutkan dari halaman ini.
          </p>
          <ActionButton href="/auth/forgot-password">Kirim ulang link reset</ActionButton>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Password baru</span>
            <Input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimal 8 karakter"
              required
              type="password"
              value={password}
            />
          </label>

          <label className="block space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Konfirmasi password</span>
            <Input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Ulangi password baru"
              required
              type="password"
              value={confirmPassword}
            />
          </label>

          {feedback ? (
            <p className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
              {feedback}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <ActionButton type="submit">
              {isSubmitting ? "Menyimpan..." : "Simpan password baru"}
            </ActionButton>
            <ActionButton href="/auth/sign-in" variant="ghost">
              Kembali ke login
            </ActionButton>
          </div>
        </form>
      )}
    </SectionCard>
  );
}

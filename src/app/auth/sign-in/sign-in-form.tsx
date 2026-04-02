"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ActionButton, Input, SectionCard } from "@/components/ui";
import { hasSupabaseEnv } from "@/lib/services/supabase-env";
import { createSupabaseBrowser } from "@/lib/services/supabase";

export function SignInForm() {
  const [magicEmail, setMagicEmail] = useState("");
  const [passwordEmail, setPasswordEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicFeedback, setMagicFeedback] = useState<string | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const [isMagicSubmitting, setIsMagicSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const isConfigured = useMemo(() => hasSupabaseEnv(), []);

  async function handleMagicLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isConfigured) {
      setMagicFeedback("Supabase env belum siap. Lengkapi .env.local terlebih dulu.");
      return;
    }

    setIsMagicSubmitting(true);
    setMagicFeedback(null);

    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOtp({
        email: magicEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      setMagicFeedback("Magic link sudah dikirim. Cek email Anda lalu lanjutkan ke aplikasi.");
    } catch (error) {
      setMagicFeedback(error instanceof Error ? error.message : "Gagal mengirim magic link.");
    } finally {
      setIsMagicSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isConfigured) {
      setPasswordFeedback("Supabase env belum siap. Lengkapi .env.local terlebih dulu.");
      return;
    }

    setIsPasswordSubmitting(true);
    setPasswordFeedback(null);

    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({
        email: passwordEmail,
        password,
      });

      if (error) {
        throw error;
      }

      window.location.assign("/dashboard");
    } catch (error) {
      setPasswordFeedback(
        error instanceof Error ? error.message : "Gagal masuk dengan password.",
      );
    } finally {
      setIsPasswordSubmitting(false);
    }
  }

  return (
    <SectionCard
      className="max-w-lg"
      description="Magic link tetap jadi jalur utama. Password login disediakan untuk akun testing atau akun yang memang sudah punya kredensial."
      title="Masuk ke AIO Tracker"
    >
      <div className="space-y-6">
        <form className="space-y-4" onSubmit={handleMagicLinkSubmit}>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--foreground)]">Magic link</p>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Cocok untuk akun pribadi utama yang masuk lewat email.
            </p>
          </div>

          <label className="block space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Email</span>
            <Input
              autoComplete="email"
              onChange={(event) => setMagicEmail(event.target.value)}
              placeholder="nama@email.com"
              required
              type="email"
              value={magicEmail}
            />
          </label>

          {magicFeedback ? (
            <p className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
              {magicFeedback}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <ActionButton type="submit">
              {isMagicSubmitting ? "Mengirim..." : "Kirim magic link"}
            </ActionButton>
          </div>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[color:color-mix(in_oklab,var(--border)_82%,transparent)]" />
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
            Atau
          </span>
          <div className="h-px flex-1 bg-[color:color-mix(in_oklab,var(--border)_82%,transparent)]" />
        </div>

        <form className="space-y-4" onSubmit={handlePasswordSubmit}>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--foreground)]">Password login</p>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Cocok untuk akun testing atau akun manual yang sudah punya email dan password.
            </p>
          </div>

          <label className="block space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Email</span>
            <Input
              autoComplete="email"
              onChange={(event) => setPasswordEmail(event.target.value)}
              placeholder="tester@contoh.com"
              required
              type="email"
              value={passwordEmail}
            />
          </label>

          <label className="block space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Password</span>
            <Input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Masukkan password akun testing"
              required
              type="password"
              value={password}
            />
          </label>

          {passwordFeedback ? (
            <p className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
              {passwordFeedback}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <ActionButton type="submit">
              {isPasswordSubmitting ? "Masuk..." : "Masuk dengan password"}
            </ActionButton>
          </div>
        </form>
      </div>
    </SectionCard>
  );
}

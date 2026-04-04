"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ActionButton, Input, SectionCard } from "@/components/ui";
import { hasSupabaseEnv } from "@/lib/services/supabase-env";

export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isConfigured = useMemo(() => hasSupabaseEnv(), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isConfigured) {
      setFeedback("Supabase env belum siap. Lengkapi .env.local terlebih dulu.");
      return;
    }

    if (password !== confirmPassword) {
      setFeedback("Konfirmasi password belum sama.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; redirectTo?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Pendaftaran gagal.");
      }

      window.location.assign(payload?.redirectTo || "/dashboard");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Pendaftaran gagal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SectionCard
      className="max-w-lg"
      description="Buat akun baru dengan email dan password biasa. Setelah daftar, akun langsung aktif tanpa verifikasi email."
      title="Buat akun AIO Tracker"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">Register biasa</p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Cocok untuk mulai cepat. Lupa password dan flow lanjutan auth menyusul setelah v1.
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

        <label className="block space-y-2 text-sm">
          <span className="font-medium text-[var(--foreground)]">Password</span>
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
            placeholder="Ulangi password"
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
            {isSubmitting ? "Membuat akun..." : "Daftar"}
          </ActionButton>
          <ActionButton href="/auth/sign-in" variant="ghost">
            Sudah punya akun
          </ActionButton>
        </div>
      </form>
    </SectionCard>
  );
}

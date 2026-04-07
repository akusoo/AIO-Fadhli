"use client";

import { useState } from "react";
import { ActionButton, Field, Input } from "@/components/ui";
import { useAppState } from "@/providers/app-state-provider";

export default function ProfilePage() {
  const { snapshot } = useAppState();

  const [name, setName] = useState(snapshot.session.name);
  const [email, setEmail] = useState(snapshot.session.email);
  const [location, setLocation] = useState(snapshot.session.location);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const handleSave = () => {
    setIsSaving(true);
    setFeedback("");
    
    // Simulasi penyimpanan karena belum ada end-point backend untuk update profil
    setTimeout(() => {
      setIsSaving(false);
      setFeedback("Perubahan berhasil disimpan sementara secara lokal.");
    }, 700);
  };

  return (
    <main className="space-y-6">
      <div className="rounded-[24px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-sm)] md:p-8">
        <div className="mb-8 border-b border-[var(--border)] pb-5">
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Profil Pengguna
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Informasi esensial pengaturan dasar akun Anda.
          </p>
        </div>

        <div className="grid max-w-2xl gap-5 md:grid-cols-2">
          <Field label="Nama Lengkap">
            <Input 
              onChange={(e) => setName(e.target.value)}
              value={name} 
            />
          </Field>
          
          <Field label="Email">
            <Input 
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              value={email} 
            />
          </Field>
          
          <div className="md:col-span-2">
            <Field label="Lokasi Saat Ini">
              <Input 
                onChange={(e) => setLocation(e.target.value)}
                value={location} 
              />
            </Field>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-end border-t border-[var(--border)] pt-5">
          <div className="flex w-full flex-col-reverse items-center justify-between gap-4 md:flex-row">
            <p className="text-sm font-medium text-[rgba(26,130,121,1)]">
              {feedback}
            </p>
            <ActionButton disabled={isSaving} onClick={handleSave}>
              {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </ActionButton>
          </div>
        </div>
      </div>
    </main>
  );
}

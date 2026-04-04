import { NextResponse } from "next/server";
import { createSupabaseAdmin, hasSupabaseAdminEnv } from "@/lib/services/supabase-admin";
import { hasSupabaseEnv } from "@/lib/services/supabase-env";
import { createSupabaseRouteHandlerClient } from "@/lib/services/supabase-server";

type SignUpPayload = {
  email?: string;
  password?: string;
};

function getDisplayNameFromEmail(email: string) {
  return email.split("@")[0]?.trim() || "Personal User";
}

function isExistingUserError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("already") ||
    normalized.includes("registered") ||
    normalized.includes("exists") ||
    normalized.includes("taken")
  );
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv() || !hasSupabaseAdminEnv()) {
    return NextResponse.json(
      { error: "Supabase auth belum siap di environment." },
      { status: 503 },
    );
  }

  const body = ((await request.json().catch(() => null)) ?? {}) as SignUpPayload;
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email) {
    return NextResponse.json({ error: "Email wajib diisi." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password minimal 8 karakter." },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: getDisplayNameFromEmail(email),
    },
  });

  if (error) {
    return NextResponse.json(
      {
        error: isExistingUserError(error.message)
          ? "Email sudah terdaftar."
          : error.message,
      },
      { status: isExistingUserError(error.message) ? 409 : 500 },
    );
  }

  if (!data.user) {
    return NextResponse.json(
      { error: "User baru gagal dibuat." },
      { status: 500 },
    );
  }

  const { supabase, applyCookies } = await createSupabaseRouteHandlerClient();
  await supabase.auth.signOut();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return NextResponse.json(
      { error: signInError.message },
      { status: 500 },
    );
  }

  const response = NextResponse.json(
    { ok: true, redirectTo: "/dashboard" },
    { status: 201 },
  );
  applyCookies(response);
  return response;
}

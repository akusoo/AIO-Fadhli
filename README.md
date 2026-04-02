# AIO Personal Tracker

Web app personal operating system untuk keuangan, hutang, wishlist, belanja, task, project, dan notes dengan backend Supabase aktif.

## Stack

- `Next.js` App Router + TypeScript
- `Tailwind CSS` v4
- `Supabase Auth + Postgres + RLS`
- `Next.js route handlers` sebagai app/server layer

## Jalankan lokal

```bash
pnpm install
pnpm dev
```

App akan terbuka di `http://localhost:3000`.

## Yang sudah ada

- Shell navigasi desktop `sidebar` + mobile `tab/sheet`
- Workspace aktif untuk dashboard, finance, debt, tasks, projects, notes, wishlist, dan shopping
- Auth magic link + boot snapshot backend
- Preview reminder Telegram berbasis data, masih `preview only`

## File penting

- `src/providers/app-state-provider.tsx`: state client, cache lokal, dan outbox ringan
- `src/lib/domain/models.ts`: kontrak tipe utama antar domain
- `src/lib/services/contracts.ts`: interface operasi domain
- `src/lib/server/app-backend.ts`: bootstrap, snapshot, dan mutasi domain backend
- `src/lib/services/supabase.ts`: helper browser client
- `src/lib/services/supabase-server.ts`: helper SSR / route handlers

## Env berikutnya

Gunakan `.env.example` sebagai referensi:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
ENABLE_E2E_TEST_ROUTES=false
E2E_TEST_SECRET=
E2E_TEST_EMAIL=
E2E_TEST_PASSWORD=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_OWNER_USER_ID=
TELEGRAM_WEBHOOK_SECRET=
```

## Backend production path

- Source of truth backend sekarang diarahkan ke `Supabase + Next.js route handlers`
- SQL schema awal ada di `supabase/migrations/0001_init_aio_personal_tracker.sql`
- Auth awal memakai `magic link`, dan halaman sign-in juga mendukung `email + password` untuk akun testing / manual yang sudah punya kredensial
- Session refresh memakai `src/proxy.ts`
- Boot snapshot dan mutasi domain hidup di route `src/app/api/**`

Untuk mulai menghubungkan project ke Supabase:

1. Buat `.env.local` dari `.env.example`
2. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Jalankan SQL migration di project Supabase
4. Buka `/auth/sign-in` untuk login pertama dan bootstrap starter data minimal

## Telegram bot

Bot Telegram sekarang disiapkan untuk pola `single-owner personal app`:

- webhook publik di `/api/telegram/webhook`
- trigger digest manual / cron di `/api/telegram/digest`
- command yang didukung: `/start`, `/help`, `/digest`, `/today`, `/debts`, `/budget`, `/ping`

Env yang dibutuhkan:

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_OWNER_USER_ID=
TELEGRAM_WEBHOOK_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
```

Catatan setup:

1. `TELEGRAM_CHAT_ID` adalah chat yang boleh menerima dan menjalankan command bot.
2. `TELEGRAM_OWNER_USER_ID` adalah `auth.users.id` milik owner data yang akan dibacakan bot.
3. `TELEGRAM_WEBHOOK_SECRET` dipakai untuk verifikasi header webhook Telegram, dan juga untuk mengamankan route digest manual.
4. Route `/api/telegram/digest` menerima `Authorization: Bearer <TELEGRAM_WEBHOOK_SECRET>` atau header `x-telegram-admin-secret`.

## End-to-end tests

Suite E2E memakai `Playwright` dan berjalan di atas backend Supabase sungguhan. Karena auth produk memakai magic link, repo ini menyediakan route helper test-only yang aktif hanya saat `ENABLE_E2E_TEST_ROUTES=true`.

Env tambahan untuk E2E:

```bash
SUPABASE_SERVICE_ROLE_KEY=
E2E_TEST_SECRET= # opsional, default lokal: aio-local-e2e
E2E_TEST_EMAIL= # opsional, default lokal disediakan
E2E_TEST_PASSWORD= # opsional, default lokal disediakan
```

Jalankan:

```bash
pnpm e2e
```

Yang diuji:

- login otomatis user test
- smoke semua halaman utama
- flow project, task, dan notes
- flow wishlist ke shopping lalu record ke finance
- flow debt dan kemunculannya di dashboard

## GitHub Actions

Workflow CI ada di `.github/workflows/ci.yml`.

Yang dilakukan saat `push` dan `pull_request`:

- `lint`
- `typecheck`
- `build`
- `Playwright E2E` jika secrets backend test tersedia

Secrets GitHub yang perlu diset agar E2E ikut jalan:

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
E2E_TEST_SECRET          # opsional
E2E_TEST_EMAIL           # opsional
E2E_TEST_PASSWORD        # opsional
```

Kalau tiga secret utama Supabase belum diisi, workflow tetap jalan untuk quality checks dan job E2E akan otomatis diskip.

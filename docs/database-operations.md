# Database Operations

Repo ini menganggap `supabase/migrations` sebagai source of truth schema.

## Project refs

- Test: `tyibvcsjstlonsyomrzz`
- Production: `wrrmxxrwjjkylnjdjcfx`

Kalau suatu hari project ref berubah, override dengan env:

```bash
export AIO_TEST_SUPABASE_PROJECT_REF=<new-test-ref>
export AIO_PROD_SUPABASE_PROJECT_REF=<new-prod-ref>
```

## Prinsip kerja

1. Semua perubahan schema harus lahir sebagai migration file di `supabase/migrations`.
2. Test DB divalidasi dulu sebelum production disentuh.
3. Production push selalu diawali `--dry-run`.
4. Production command wajib memakai `AIO_ALLOW_PROD=1`.
5. Backup schema production memakai `pg_dump` direct ke Postgres, bukan bergantung ke `supabase db dump`.
6. Repo tidak otomatis meng-apply migration ke production setiap ada commit. Production tetap gated dan manual.

## Otomatis vs manual

Yang sekarang otomatis:

- CI tetap mengecek kualitas app setiap `push` dan `pull_request`.
- Script repo-level membuat command schema lebih konsisten dan repeatable.

Yang sengaja masih manual:

- `db push` ke Test
- `db push` ke Production
- backup schema Production

Alasannya: apply migration ke database production tanpa gate manusia terlalu berisiko untuk app yang masih aktif berubah cepat. Pola yang lebih aman adalah:

1. buat migration file
2. push ke Test
3. verifikasi app
4. baru push ke Production dengan `AIO_ALLOW_PROD=1`

## Commands

Lihat status migration:

```bash
pnpm db:test:status
pnpm db:prod:status
```

Dry run push:

```bash
pnpm db:test:push:dry
AIO_ALLOW_PROD=1 pnpm db:prod:push:dry
```

Apply push:

```bash
pnpm db:test:push
AIO_ALLOW_PROD=1 pnpm db:prod:push
```

Backup schema:

```bash
export SUPABASE_DB_PASSWORD=<db-password>
AIO_ALLOW_PROD=1 pnpm db:prod:dump
```

## Release flow yang disarankan

Setelah membuat migration baru:

```bash
pnpm db:test:status
pnpm db:test:push:dry
pnpm db:test:push
pnpm lint
pnpm typecheck
pnpm build
AIO_ALLOW_PROD=1 pnpm db:prod:push:dry
AIO_ALLOW_PROD=1 pnpm db:prod:push
```

Kalau ingin menyimpan snapshot schema production sebelum deploy:

```bash
export SUPABASE_DB_PASSWORD=<db-password>
AIO_ALLOW_PROD=1 pnpm db:prod:dump
```

## Recovery notes

Kalau remote schema sudah ada tetapi history migration belum tercatat:

```bash
supabase link --project-ref <project-ref>
supabase migration list
supabase migration repair --status applied <version>
```

Gunakan `migration repair` hanya kalau Anda sudah yakin SQL di version tersebut memang sudah ada di remote database.

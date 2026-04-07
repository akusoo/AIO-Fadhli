#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/db/dump-schema.sh <test|prod> [output-file]" >&2
  exit 1
fi

require_command pg_dump

environment="$1"
shift

project_ref="$(resolve_project_ref "${environment}")"
assert_prod_confirmation "${environment}"

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "SUPABASE_DB_PASSWORD is required for schema dumps." >&2
  exit 1
fi

output_file="${1:-$(resolve_dump_path "${environment}")}"

mkdir -p "$(dirname "${output_file}")"

print_target_banner "${environment}" "${project_ref}"
printf 'Output      : %s\n' "${output_file}"

PGPASSWORD="${SUPABASE_DB_PASSWORD}" pg_dump \
  "host=db.${project_ref}.supabase.co port=5432 dbname=postgres user=postgres sslmode=require" \
  --schema-only \
  --schema=public \
  --no-owner \
  --no-privileges \
  --file="${output_file}"

ls -lh "${output_file}"

#!/usr/bin/env bash

set -euo pipefail

readonly DB_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly DB_REPO_ROOT="$(cd "${DB_LIB_DIR}/../.." && pwd)"
readonly DEFAULT_TEST_PROJECT_REF="tyibvcsjstlonsyomrzz"
readonly DEFAULT_PROD_PROJECT_REF="wrrmxxrwjjkylnjdjcfx"

require_command() {
  local command_name="$1"

  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
}

resolve_project_ref() {
  local target_environment="$1"

  case "${target_environment}" in
    test)
      printf '%s\n' "${AIO_TEST_SUPABASE_PROJECT_REF:-$DEFAULT_TEST_PROJECT_REF}"
      ;;
    prod)
      printf '%s\n' "${AIO_PROD_SUPABASE_PROJECT_REF:-$DEFAULT_PROD_PROJECT_REF}"
      ;;
    *)
      echo "Unknown environment '${environment}'. Use 'test' or 'prod'." >&2
      exit 1
      ;;
  esac
}

resolve_dump_path() {
  local target_environment="$1"
  local timestamp

  timestamp="$(date +%Y-%m-%d-%H%M%S)"
  printf '%s\n' "${DB_REPO_ROOT}/supabase/backups/${target_environment}-schema-${timestamp}.sql"
}

link_project() {
  local target_project_ref="$1"

  require_command supabase
  (
    cd "${DB_REPO_ROOT}"
    supabase link --project-ref "${target_project_ref}" >/dev/null
  )
}

assert_prod_confirmation() {
  local target_environment="$1"

  if [[ "${target_environment}" == "prod" && "${AIO_ALLOW_PROD:-0}" != "1" ]]; then
    cat >&2 <<'EOF'
Refusing to run a production schema command without confirmation.
Set AIO_ALLOW_PROD=1 and rerun if you really mean production.
EOF
    exit 1
  fi
}

print_target_banner() {
  local target_environment="$1"
  local target_project_ref="$2"

  printf 'Environment : %s\n' "${target_environment}"
  printf 'Project ref : %s\n' "${target_project_ref}"
}

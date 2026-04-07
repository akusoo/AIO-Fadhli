#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/db/push.sh <test|prod> [--dry-run] [--yes]" >&2
  exit 1
fi

environment="$1"
shift

dry_run=0
assume_yes=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      dry_run=1
      ;;
    --yes)
      assume_yes=1
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done

project_ref="$(resolve_project_ref "${environment}")"
assert_prod_confirmation "${environment}"

print_target_banner "${environment}" "${project_ref}"
link_project "${project_ref}"

command=(supabase db push)

if [[ "${dry_run}" == "1" ]]; then
  command+=(--dry-run)
fi

if [[ "${assume_yes}" == "1" ]]; then
  command+=(--yes)
fi

(
  cd "${DB_REPO_ROOT}"
  "${command[@]}"
)

#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

readonly environment="${1:-test}"
readonly project_ref="$(resolve_project_ref "${environment}")"

print_target_banner "${environment}" "${project_ref}"
link_project "${project_ref}"

(
  cd "${DB_REPO_ROOT}"
  supabase migration list
)

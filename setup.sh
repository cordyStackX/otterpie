#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

ENV_FILE=".env"
umask 077
KEYS_ONLY=false

case "${1:-}" in
  "") ;;
  --keys-only) KEYS_ONLY=true ;;
  *)
    printf 'Usage: %s [--keys-only]\n' "${0##*/}" >&2
    exit 2
    ;;
esac

if ! command -v openssl >/dev/null 2>&1; then
  printf 'Error: OpenSSL is required to generate secure application keys.\n' >&2
  exit 1
fi

if [[ ! -e "$ENV_FILE" ]]; then
  : > "$ENV_FILE"
fi

has_nonempty_value() {
  local wanted_key="$1"

  awk -v wanted_key="$wanted_key" '
    {
      line = $0
      sub(/^[[:space:]]*/, "", line)
      sub(/^export[[:space:]]+/, "", line)
      separator = index(line, "=")
      if (!separator) next

      name = substr(line, 1, separator - 1)
      value = substr(line, separator + 1)
      sub(/[[:space:]]+$/, "", name)
      sub(/^[[:space:]]*/, "", value)
      sub(/[[:space:]]*#.*/, "", value)
      sub(/[[:space:]]+$/, "", value)

      if (name == wanted_key && value != "") found = 1
    }
    END { exit !found }
  ' "$ENV_FILE"
}

add_key_if_missing() {
  local key_name="$1"

  if has_nonempty_value "$key_name"; then
    printf 'Kept existing %s\n' "$key_name"
    return
  fi

  local generated_value
  generated_value="$(openssl rand -base64 48 | tr -d '\n')"
  printf '%s=%s\n' "$key_name" "$generated_value" >> "$ENV_FILE"
  unset generated_value
  printf 'Generated %s\n' "$key_name"
}

for key_name in \
  API_KEY \
  JWT_SECRET \
  WALLET_BANK_KEY \
  WALLET_BANK_KEY_1 \
  WALLET_BANK_KEY_2
do
  add_key_if_missing "$key_name"
done

chmod 600 "$ENV_FILE"
printf 'Security keys are ready in %s. Values were not printed.\n' "$ENV_FILE"

if [[ "$KEYS_ONLY" == true ]]; then
  printf 'Keys-only mode requested; setup steps were skipped.\n'
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  printf 'Error: pnpm is required. Install pnpm, then run this script again.\n' >&2
  exit 1
fi

printf '\nInstalling dependencies…\n'
pnpm install

if [[ -f "supabase-project/docker-compose.yml" && -f "supabase-project/run.sh" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    printf 'Error: Docker is required to start the Supabase project.\n' >&2
    exit 1
  fi
  printf '\nStarting the Supabase Docker stack…\n'
  sh supabase-project/run.sh start
else
  printf '\nSupabase Docker project not found; skipping Docker services.\n'
fi

printf '\nRunning lint…\n'
pnpm lint

printf '\nBuilding the production app…\n'
pnpm build

printf '\nStarting the production server…\n'
pnpm start

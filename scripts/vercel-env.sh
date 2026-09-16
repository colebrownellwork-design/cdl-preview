#!/usr/bin/env bash
#
# Pushes the keys in .env.local up to Vercel, for all three environments.
#
# Reads the values straight from the file so no secret has to be typed,
# pasted or echoed. Run it after `vercel link`.
#
#   bash scripts/vercel-env.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.local ] || { echo "No .env.local here."; exit 1; }
set -a; . ./.env.local; set +a

# NEXT_PUBLIC_* are compiled into the browser bundle; the rest stay server-side.
KEYS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  SUPABASE_SECRET_KEY
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
)

for key in "${KEYS[@]}"; do
  value="${!key:-}"                         # indirect expansion: value of $key
  if [ -z "${value}" ]; then
    echo "skip  ${key} (empty)"
    continue
  fi
  for env in production preview development; do
    # Remove first so a re-run updates rather than erroring on a duplicate.
    npx vercel env rm "${key}" "${env}" --yes >/dev/null 2>&1 || true
    printf '%s' "${value}" | npx vercel env add "${key}" "${env}" >/dev/null
  done
  echo "set   ${key} (production, preview, development)"
done

echo
echo "Done. Redeploy for these to take effect:  npx vercel --prod"

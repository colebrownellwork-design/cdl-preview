#!/usr/bin/env bash
#
# Sets or resets the password for a sign-in, without the password appearing in
# the terminal, the shell history, or a process listing.
#
#   bash scripts/set-password.sh you@example.com
#
set -euo pipefail
cd "$(dirname "$0")/.."

EMAIL="${1:-}"
[ -n "$EMAIL" ] || { echo "Usage: bash scripts/set-password.sh <email>"; exit 1; }
[ -f .env.local ] || { echo "No .env.local here."; exit 1; }

read -rs -p "New password for ${EMAIL} (min 8 chars): " PW1; echo
read -rs -p "Again: " PW2; echo
[ "$PW1" = "$PW2" ] || { echo "They do not match."; exit 1; }
[ ${#PW1} -ge 8 ] || { echo "Too short - Supabase requires at least 8."; exit 1; }

# Passed through the environment, never as an argument, so it stays out of `ps`.
EMAIL="$EMAIL" PW="$PW1" node --env-file=.env.local -e '
const { createClient } = require("@supabase/supabase-js");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
(async () => {
  const { data } = await db.auth.admin.listUsers();
  const user = data.users.find((u) => u.email === process.env.EMAIL);
  if (!user) { console.error("No such user:", process.env.EMAIL); process.exit(1); }
  const { error } = await db.auth.admin.updateUserById(user.id, { password: process.env.PW });
  if (error) { console.error("Failed:", error.message); process.exit(1); }

  // Setting it is not proof it works. Sign in the way the login page does, so a
  // password typed blind and mistyped the same way twice is caught here rather
  // than at the login screen.
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const { data: session, error: signInError } = await anon.auth.signInWithPassword({
    email: process.env.EMAIL,
    password: process.env.PW,
  });
  if (!session?.session) {
    console.error("Password was set but sign-in failed:", signInError && signInError.message);
    process.exit(1);
  }
  await anon.auth.signOut();
  console.log("Password set for", process.env.EMAIL, "- and sign-in verified.");
})();
'
unset PW1 PW2

/**
 * Adds trade platforms to the monitored list.
 *
 * Only the eight named anywhere in the prototype are seeded. This list is a
 * public claim about what CDL monitors, so entries should come from the real
 * checklist rather than a guess.
 *
 *   node --env-file=.env.local scripts/add-platforms.mjs "Descartes" "ImportInfo" ...
 *
 * Slugs are derived from the name; re-running with a name already on record
 * leaves it alone.
 */
import { createClient } from '@supabase/supabase-js';

const names = process.argv.slice(2).filter(Boolean);
if (!names.length) {
  console.error('Usage: node --env-file=.env.local scripts/add-platforms.mjs "Name One" "Name Two"');
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const slugify = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const { data: current } = await db.from('platforms').select('slug, sort');
const existing = new Set((current ?? []).map((p) => p.slug));
let sort = Math.max(0, ...(current ?? []).map((p) => p.sort)) + 10;

for (const name of names) {
  const slug = slugify(name);
  if (existing.has(slug)) {
    console.log(`skip  ${name} (already on record)`);
    continue;
  }
  const { error } = await db.from('platforms').insert({ slug, name, sort });
  console.log(error ? `FAIL  ${name}: ${error.message}` : `add   ${name}  (${slug})`);
  sort += 10;
}

const { count } = await db.from('platforms').select('*', { count: 'exact', head: true });
console.log(`\n${count} platforms on record.`);

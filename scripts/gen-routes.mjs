/**
 * One-shot scaffolder: writes a route file per prototype page. Run once; the
 * generated routes are real source from then on (forms and auth get wired into
 * them by hand), so this is not part of the build.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { PAGES } from './extract-prototype.mjs';

for (const { slug, route } of PAGES) {
  const dir = 'app' + (route === '/' ? '' : route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/page.tsx`,
    `import PrototypePage from '@/app/_components/PrototypePage';
import body from '@/app/_prototype/${slug}/body';
import { title, description } from '@/app/_prototype/${slug}/meta';
import '@/app/_prototype/${slug}/page.css';

export const metadata = { title, ...(description ? { description } : {}) };

export default function Page() {
  return <PrototypePage slug="${slug}" html={body} />;
}
`,
  );
  console.log(`${route.padEnd(18)} -> ${dir}/page.tsx`);
}

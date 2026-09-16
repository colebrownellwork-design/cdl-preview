/**
 * Extracts the static prototype in `prototype/` into per-route assets the Next
 * app renders: scoped CSS, body markup, and the page script.
 *
 * The prototype pages are 12 self-contained HTML files that were never meant to
 * share a document. 87 of their selectors conflict (`:root`, `body`, `.pill`,
 * `.topbar`, `.hero`...) and all 3 keyframe names are reused with different
 * bodies. So each page's CSS is prefixed with its own `.pg-<slug>` wrapper and
 * its keyframes are renamed, which lets the pages coexist untouched.
 *
 * Output (generated, git-ignored): app/_prototype/<slug>/{page.css,body.html,page.js}
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import prefixer from 'postcss-prefix-selector';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = `${root}/app/_prototype`;

/** prototype file -> { slug, route } . Routes are the new canonical URLs. */
export const PAGES = [
  { file: 'CDL-home-demo-r4.html', slug: 'home', route: '/' },
  { file: 'CDL-pricing-demo-r4.html', slug: 'pricing', route: '/pricing' },
  { file: 'CDL-check-demo-r4.html', slug: 'check', route: '/exposure-check' },
  { file: 'CDL-faq-demo-r4.html', slug: 'faq', route: '/faq' },
  { file: 'CDL-blog-demo-r4.html', slug: 'blog', route: '/blog' },
  { file: 'CDL-post-demo-r4.html', slug: 'post', route: '/blog/the-post' },
  { file: 'CDL-case-demo-r4.html', slug: 'case', route: '/case-studies' },
  { file: 'CDL-testimonials-demo-r4.html', slug: 'testimonials', route: '/testimonials' },
  { file: 'CDL-data-demo-r4.html', slug: 'data', route: '/contact' },
  { file: 'CDL-login-demo-r4.html', slug: 'login', route: '/login' },
  { file: 'CDL-portal-demo-r4.html', slug: 'portal', route: '/portal' },
  { file: 'CDL-admin-demo-r4.html', slug: 'admin', route: '/admin' },
];

const ROUTE_BY_FILE = Object.fromEntries(PAGES.map((p) => [p.file, p.route]));

const section = (html, tag) =>
  [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))].map((m) => m[1]);

/** Rewrites prototype-relative links and asset paths to app URLs. */
function rewriteLinks(html) {
  for (const [file, route] of Object.entries(ROUTE_BY_FILE)) {
    // href="CDL-x.html"  and  href="CDL-x.html#anchor"
    html = html.replaceAll(`"${file}"`, `"${route}"`);
    html = html.replaceAll(`"${file}#`, `"${route === '/' ? '' : route}#`);
    html = html.replaceAll(`"${file}?`, `"${route}?`);
  }
  // assets moved from the repo root into public/
  return html.replace(/(src|href)="(logo|photography|platform-logos)\//g, '$1="/$2/');
}

/** Scopes one page's CSS under `.pg-<slug>` and namespaces its keyframes. */
function scopeCss(css, slug) {
  const prefix = `.pg-${slug}`;
  const kf = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);

  const plugin = prefixer({
    prefix,
    transform(prefix, selector, prefixedSelector) {
      // Document-level selectors become the wrapper itself, so the page's
      // custom properties and background land on `.pg-<slug>`.
      for (const root of [':root', 'html', 'body']) {
        if (selector === root) return prefix;
        if (selector.startsWith(root + ' ')) return prefix + selector.slice(root.length);
        if (selector.startsWith(root + '.') || selector.startsWith(root + '[')) {
          return prefix + selector.slice(root.length);
        }
      }
      return prefixedSelector;
    },
  });

  let out = postcss([plugin]).process(css, { from: undefined }).css;

  // Keyframe names are global no matter how the rules are scoped, and all three
  // names in this prototype are reused across pages with different bodies.
  for (const name of new Set(kf)) {
    const scoped = `${slug}-${name}`;
    out = out.replace(new RegExp(`(@keyframes\\s+)${name}\\b`, 'g'), `$1${scoped}`);
    out = out.replace(
      new RegExp(`(animation(?:-name)?\\s*:[^;}]*?\\b)${name}\\b`, 'g'),
      `$1${scoped}`,
    );
  }
  // The prototype pulls Geist from the Google Fonts CDN. The app self-hosts it
  // with next/font, so point the page's font tokens at those variables instead.
  out = out
    .replace(/--font-sans:\s*"Geist"/g, '--font-sans: var(--font-geist-sans)')
    .replace(/--font-mono:\s*"Geist Mono"/g, '--font-mono: var(--font-geist-mono)');

  // url(photography/x.jpg) -> url(/photography/x.jpg)
  return out.replace(/url\((['"]?)(logo|photography|platform-logos)\//g, 'url($1/$2/');
}

rmSync(OUT, { recursive: true, force: true });

const summary = [];
for (const { file, slug } of PAGES) {
  const html = readFileSync(`${root}/prototype/${file}`, 'utf8');

  const css = scopeCss(section(html, 'style').join('\n'), slug);
  const js = section(html, 'script').join('\n;\n');

  let body = section(html, 'body')[0] ?? '';
  body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  body = rewriteLinks(body).trim();

  const dir = `${OUT}/${slug}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/page.css`, css);
  // Markup ships as a module rather than a file read at request time, so it is
  // bundled normally and needs no serverless file tracing.
  writeFileSync(`${dir}/body.ts`, `// generated by scripts/extract-prototype.mjs\nexport default ${JSON.stringify(body)};\n`);

  // `<title>` reads "Customs Data Lock · X"; the layout already supplies the
  // brand half through its title template, so keep only X.
  const rawTitle = (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '').trim();
  const title = rawTitle.replace(/^Customs Data Lock\s*·\s*/, '');
  const description = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? '').trim();
  writeFileSync(
    `${dir}/meta.ts`,
    `// generated by scripts/extract-prototype.mjs\nexport const title = ${JSON.stringify(title)};\nexport const description = ${JSON.stringify(description)};\n`,
  );

  // Page scripts are served as static assets and loaded per route.
  mkdirSync(`${root}/public/_prototype`, { recursive: true });
  writeFileSync(`${root}/public/_prototype/${slug}.js`, rewriteLinks(js));

  summary.push({ slug, css: css.length, html: body.length, js: js.length });
}

console.table(summary);
console.log(`extracted ${summary.length} pages -> app/_prototype/`);

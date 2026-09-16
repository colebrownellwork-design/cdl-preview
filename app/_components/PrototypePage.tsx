import Script from 'next/script';

/**
 * Renders one extracted prototype page.
 *
 * The markup and the page script are used verbatim, which is the point: the
 * design is the deliverable and rewriting it into components would quietly
 * change it. The `.pg-<slug>` wrapper is what that page's scoped stylesheet
 * hangs off, so it has to match the slug the extractor used.
 *
 * Note the prototype's internal links are plain `<a href>`, not next/link, so
 * moving between these pages is a full document load. That is deliberate: each
 * page script is a one-shot IIFE that expects a fresh document.
 */
export default function PrototypePage({ slug, html }: { slug: string; html: string }) {
  return (
    <>
      <div className={`pg-${slug}`} dangerouslySetInnerHTML={{ __html: html }} />
      {/* Before the page script: it watches for the body-appended backdrops
          those scripts create and moves them inside the wrapper. */}
      <Script src="/scope-shim.js" strategy="afterInteractive" />
      <Script src={`/_prototype/${slug}.js`} strategy="afterInteractive" />
      {/* Loaded everywhere rather than per-route: it no-ops on pages with no
          forms, and that beats a slug list that can drift out of date. */}
      <Script src="/form-bridge.js" strategy="afterInteractive" />
    </>
  );
}

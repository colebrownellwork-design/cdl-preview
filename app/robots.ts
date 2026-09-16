import { headers } from 'next/headers';
import type { MetadataRoute } from 'next';

/** The only host that should ever appear in search results. */
const CANONICAL_HOST = 'customsdatalock.com';

/**
 * Vercel's production URL is public - its standard protection covers preview
 * deployments only. Without this, `cdl-website-lime.vercel.app` would be
 * indexable and would compete with the real domain for the same content.
 *
 * So: allow crawling on the canonical host, refuse it everywhere else.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host') ?? '';
  const isCanonical = host === CANONICAL_HOST || host === `www.${CANONICAL_HOST}`;

  if (!isCanonical) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/portal', '/api/'] },
    sitemap: `https://${CANONICAL_HOST}/sitemap.xml`,
  };
}

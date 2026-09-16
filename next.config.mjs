/** @type {import('next').NextConfig} */
const nextConfig = {
  // The old Marketpath site's URLs, kept alive so existing search rankings and
  // inbound links land on the matching page of the rebuild.
  async redirects() {
    return [
      { source: '/see-your-data', destination: '/exposure-check', permanent: true },
      { source: '/contact-us', destination: '/contact', permanent: true },
      { source: '/resources/faqs', destination: '/faq', permanent: true },
      { source: '/resources/testimonials', destination: '/testimonials', permanent: true },
      { source: '/buy-now', destination: '/pricing', permanent: true },
      { source: '/services', destination: '/pricing', permanent: true },
      { source: '/sites-we-cover', destination: '/faq', permanent: true },
      { source: '/about', destination: '/', permanent: true },
    ];
  },
};

export default nextConfig;

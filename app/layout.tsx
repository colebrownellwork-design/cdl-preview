import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

// Self-hosted rather than pulled from the Google Fonts CDN: the site's own
// footer promises no third-party requests, so it should not make one for type.
const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL('https://customsdatalock.com'),
  title: {
    default: 'Customs Data Lock',
    template: '%s · Customs Data Lock',
  },
  description:
    'Your shipment records stop appearing on public trade platforms. Customs Data Lock files and maintains CBP vessel manifest confidentiality for US importers.',
  icons: { icon: '/logo/official/cdl-favicon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

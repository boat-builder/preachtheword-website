import type { Metadata, Viewport } from 'next';
import { Newsreader, Public_Sans } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { SITE } from '@/lib/site';
import ToastProvider from '@/components/ToastProvider';
import './globals.css';

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Sermons on mission, discipleship, hope, salvation & repentance`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    'sermons',
    'Bible teaching',
    'Christian messages',
    'gospel',
    'mission',
    'discipleship',
    'salvation',
    'repentance',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.description,
    url: SITE.url,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE.name,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // ClerkProvider supplies auth context to the /admin panel. It is compatible
    // with static rendering — public pages stay statically generated because they
    // never call Clerk's auth()/currentUser(). Header/Footer + JSON-LD live in the
    // (site) route group's layout; admin gets its own full-screen chrome.
    <ClerkProvider>
      <html
        lang="en"
        data-scroll-behavior="smooth"
        className={`${publicSans.variable} ${newsreader.variable}`}
      >
        <body>
          <ToastProvider>{children}</ToastProvider>
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}

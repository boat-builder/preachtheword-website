import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  THEMES,
  getTheme,
  sermonsInTheme,
  themeCount,
} from '@/lib/sermons';
import { SITE, absoluteUrl } from '@/lib/site';
import SermonCard from '@/components/SermonCard';
import { ThemeShareButtons } from '@/components/ShareControls';
import styles from './theme.module.css';

export const dynamicParams = false;

export function generateStaticParams() {
  return THEMES.map((t) => ({ theme: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ theme: string }>;
}): Promise<Metadata> {
  const { theme: key } = await params;
  const theme = getTheme(key);
  if (!theme) return {};

  const title = `${theme.name} — Sermons`;
  return {
    title,
    description: theme.blurb,
    alternates: { canonical: `/themes/${theme.slug}` },
    openGraph: {
      type: 'website',
      title: `${theme.name} sermons — ${SITE.name}`,
      description: theme.blurb,
      url: `/themes/${theme.slug}`,
      siteName: SITE.name,
    },
  };
}

export default async function ThemePage({
  params,
}: {
  params: Promise<{ theme: string }>;
}) {
  const { theme: key } = await params;
  const theme = getTheme(key);
  if (!theme) notFound();

  const sermons = sermonsInTheme(theme.key);
  const count = themeCount(theme.key);
  const countLabel =
    count === 0
      ? 'Theme · coming soon'
      : `Theme · ${count} message${count === 1 ? '' : 's'}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${theme.name} — Sermons`,
    description: theme.blurb,
    url: absoluteUrl(`/themes/${theme.slug}`),
    isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url },
    hasPart: sermons.map((s) => ({
      '@type': 'VideoObject',
      name: s.title,
      url: absoluteUrl(`/sermons/${s.slug}`),
    })),
  };

  return (
    <main className="viewIn">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <Link href="/themes" className={styles.back}>
            ← All themes
          </Link>
          <div className={styles.heroRow}>
            <div className={styles.heroText}>
              <div className={styles.countLabel}>{countLabel}</div>
              <h1 className={styles.title}>{theme.name}</h1>
              <p className={styles.blurb}>{theme.blurb}</p>
            </div>
            <ThemeShareButtons slug={theme.slug} name={theme.name} />
          </div>
        </div>
      </section>

      <section className={`container ${styles.list}`}>
        {sermons.length > 0 ? (
          <div className={styles.grid}>
            {sermons.map((sermon) => (
              <SermonCard key={sermon.id} sermon={sermon} showCategory={false} />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>New messages coming soon</div>
            <p className={styles.emptyText}>
              This theme is being filled as new sermons are added.
            </p>
            <Link href="/sermons" className={styles.emptyBtn}>
              Browse all messages
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

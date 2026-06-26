import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  SERMONS,
  getSermon,
  relatedSermons,
  themeName,
  formatDate,
  embedUrl,
  watchUrl,
  thumbUrl,
  thumbUrlHd,
  durationIso,
  getTheme,
} from '@/lib/sermons';
import { SITE, absoluteUrl } from '@/lib/site';
import { SermonShareRow } from '@/components/ShareControls';
import Duration from '@/components/Duration';
import RelatedSermons from '@/components/RelatedSermons';
import styles from './sermon.module.css';

export const dynamicParams = false;

export function generateStaticParams() {
  return SERMONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sermon = getSermon(slug);
  if (!sermon) return {};

  const url = `/sermons/${sermon.slug}`;
  const title = sermon.title;
  const description = sermon.short;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'video.other',
      title,
      description,
      url,
      siteName: SITE.name,
      images: [{ url: thumbUrlHd(sermon.videoId), width: 1280, height: 720 }],
      videos: [{ url: embedUrl(sermon.videoId) }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [thumbUrlHd(sermon.videoId)],
    },
  };
}

export default async function SermonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sermon = getSermon(slug);
  if (!sermon) notFound();

  const theme = getTheme(sermon.category);
  const related = relatedSermons(sermon);
  const pageUrl = absoluteUrl(`/sermons/${sermon.slug}`);

  const videoJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: sermon.title,
    description: sermon.short,
    thumbnailUrl: [thumbUrlHd(sermon.videoId), thumbUrl(sermon.videoId)],
    uploadDate: sermon.date,
    contentUrl: watchUrl(sermon.videoId),
    embedUrl: embedUrl(sermon.videoId),
    url: pageUrl,
    publisher: {
      '@type': 'Organization',
      name: SITE.name,
      url: SITE.url,
    },
    about: themeName(sermon.category),
    // Length as ISO 8601, only when we have it (improves video rich results).
    ...(sermon.durationSeconds ? { duration: durationIso(sermon.durationSeconds) } : {}),
    inLanguage: 'en',
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
      {
        '@type': 'ListItem',
        position: 2,
        name: theme?.name ?? 'Sermons',
        item: theme ? absoluteUrl(`/themes/${theme.slug}`) : absoluteUrl('/sermons'),
      },
      { '@type': 'ListItem', position: 3, name: sermon.title, item: pageUrl },
    ],
  };

  return (
    <main className={`viewIn ${styles.main}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <Link href="/sermons" className={styles.back}>
        ← Back to library
      </Link>

      <div className={styles.crumbs}>
        {theme && (
          <Link href={`/themes/${theme.slug}`} className={styles.themeChip}>
            {theme.name}
          </Link>
        )}
        <span className={styles.crumbMuted}>{sermon.ref}</span>
        <span className={styles.crumbDivider}>·</span>
        <span className={styles.crumbMuted}>{formatDate(sermon.date)}</span>
        {sermon.durationSeconds ? (
          <>
            <span className={styles.crumbDivider}>·</span>
            <Duration seconds={sermon.durationSeconds} className={styles.crumbMuted} />
          </>
        ) : null}
      </div>

      <h1 className={styles.title}>{sermon.title}</h1>

      <div className={styles.player}>
        <iframe
          src={embedUrl(sermon.videoId)}
          title={sermon.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className={styles.iframe}
        />
      </div>

      <SermonShareRow
        slug={sermon.slug}
        title={sermon.title}
        short={sermon.short}
        watchUrl={watchUrl(sermon.videoId)}
      />

      <div className={styles.content}>
        <div>
          <div className={styles.kicker}>In short</div>
          <p className={styles.lead}>{sermon.short}</p>
        </div>

        <div className={styles.rule} />

        <div>
          <div className={styles.kicker}>The full message</div>
          <div className={styles.body}>
            {sermon.long.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <RelatedSermons themeName={themeName(sermon.category)} sermons={related} />
      )}
    </main>
  );
}

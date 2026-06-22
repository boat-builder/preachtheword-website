import type { Metadata } from 'next';
import Link from 'next/link';
import {
  SERMONS,
  sermonsByDate,
  searchSermons,
  sermonsForTag,
} from '@/lib/sermons';
import { SITE } from '@/lib/site';
import SermonCard from '@/components/SermonCard';
import styles from './browse.module.css';

type SearchParams = Promise<{ q?: string; tag?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { q, tag } = await searchParams;
  const filtering = Boolean(q || tag);

  return {
    title: q
      ? `Search: ${q}`
      : tag
        ? `${tag} — Messages`
        : 'All sermons',
    description:
      'Browse the full library of messages — watch, read, and share sermons on mission, discipleship, future hope, salvation, and repentance.',
    alternates: { canonical: '/sermons' },
    // Only the canonical, unfiltered list should be indexed.
    robots: filtering ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: `All sermons — ${SITE.name}`,
      description: 'The full library of messages.',
      url: '/sermons',
      siteName: SITE.name,
    },
  };
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, tag } = await searchParams;

  let list = sermonsByDate(SERMONS);
  let heading = 'All Messages';
  let sub = 'Every message in the collection.';

  if (tag) {
    list = sermonsForTag(tag);
    heading = `“${tag}”`;
    sub = 'Messages that speak to this need.';
  } else if (q) {
    list = searchSermons(q);
    heading = `Results for “${q}”`;
    sub = `${list.length} message${list.length === 1 ? '' : 's'} found.`;
  }

  return (
    <main className={`container viewIn ${styles.main}`}>
      <Link href="/" className={styles.back}>
        ← Home
      </Link>
      <h1 className={styles.heading}>{heading}</h1>
      <p className={styles.sub}>{sub}</p>

      {list.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No messages found</div>
          <p className={styles.emptyText}>Try another word, or browse by theme.</p>
          <Link href="/" className={styles.emptyBtn}>
            Back home
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {list.map((sermon) => (
            <SermonCard key={sermon.id} sermon={sermon} />
          ))}
        </div>
      )}
    </main>
  );
}

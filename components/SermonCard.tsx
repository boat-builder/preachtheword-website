import Link from 'next/link';
import Image from 'next/image';
import {
  type Sermon,
  formatDate,
  themeName,
  thumbUrl,
} from '@/lib/sermons';
import { CardShareButton } from './ShareControls';
import styles from './SermonCard.module.css';

export default function SermonCard({
  sermon,
  showCategory = true,
}: {
  sermon: Sermon;
  showCategory?: boolean;
}) {
  const href = `/sermons/${sermon.slug}`;

  return (
    <article className={styles.card}>
      <Link
        href={href}
        className={styles.thumb}
        aria-label={`Watch & read “${sermon.title}”`}
      >
        <Image
          src={thumbUrl(sermon.videoId)}
          alt=""
          fill
          sizes="(max-width: 760px) 100vw, (max-width: 1180px) 50vw, 380px"
          className={styles.thumbImg}
        />
        <span className={styles.play}>
          <span className={styles.playGlyph} />
        </span>
      </Link>

      <div className={styles.body}>
        {showCategory ? (
          <div className={styles.metaRow}>
            <span className={styles.chip}>{themeName(sermon.category)}</span>
            <span className={styles.date}>{formatDate(sermon.date)}</span>
          </div>
        ) : (
          <span className={styles.refDate}>
            {sermon.ref} · {formatDate(sermon.date)}
          </span>
        )}

        <h3 className={styles.title}>
          <Link href={href} className={styles.titleLink}>
            {sermon.title}
          </Link>
        </h3>

        <p className={styles.short}>{sermon.short}</p>

        <div className={styles.actions}>
          <Link href={href} className={styles.watch}>
            Watch &amp; read →
          </Link>
          <CardShareButton slug={sermon.slug} title={sermon.title} />
        </div>
      </div>
    </article>
  );
}

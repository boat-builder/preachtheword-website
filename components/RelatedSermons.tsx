import Link from 'next/link';
import Image from 'next/image';
import { type Sermon, formatDate, thumbUrl } from '@/lib/sermons';
import styles from './RelatedSermons.module.css';

export default function RelatedSermons({
  themeName,
  sermons,
}: {
  themeName: string;
  sermons: Sermon[];
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>More on {themeName}</h2>
      <div className={styles.grid}>
        {sermons.map((s) => (
          <Link key={s.id} href={`/sermons/${s.slug}`} className={styles.card}>
            <div className={styles.thumb}>
              <Image
                src={thumbUrl(s.videoId)}
                alt=""
                fill
                sizes="(max-width: 760px) 100vw, 300px"
                className={styles.thumbImg}
              />
            </div>
            <div className={styles.body}>
              <h3 className={styles.title}>{s.title}</h3>
              <span className={styles.date}>{formatDate(s.date)}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

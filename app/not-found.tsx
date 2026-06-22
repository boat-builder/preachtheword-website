import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <main className={`container ${styles.main}`}>
      <div className={styles.eyebrow}>404</div>
      <h1 className={styles.title}>We couldn’t find that page</h1>
      <p className={styles.text}>
        The message or theme you’re looking for may have moved. Browse the full
        library or start from the home page.
      </p>
      <div className={styles.actions}>
        <Link href="/" className={styles.primary}>
          Back home
        </Link>
        <Link href="/sermons" className={styles.secondary}>
          Browse all sermons
        </Link>
      </div>
    </main>
  );
}

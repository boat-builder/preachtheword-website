import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import styles from './not-found.module.css';

// Lives at the root (outside the (site) route group), so it renders the
// public chrome itself rather than inheriting it from the site layout.
export default function NotFound() {
  return (
    <>
      <Header />
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
      <Footer />
    </>
  );
}

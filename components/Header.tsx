import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SITE } from '@/lib/site';
import { CollectionShareButton } from './ShareControls';
import SearchBox from './SearchBox';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <Link href="/" className={styles.brand} aria-label={`${SITE.name} — home`}>
          <Image
            src="/logo.png"
            alt=""
            width={38}
            height={38}
            className={styles.mark}
            priority
          />
          <span className={styles.brandText}>
            <span className={styles.brandName}>{SITE.name}</span>
            <span className={styles.brandRef}>{SITE.reference}</span>
          </span>
        </Link>

        <Suspense fallback={<div className={styles.searchSlot} />}>
          <SearchBox />
        </Suspense>

        <nav className={styles.nav}>
          <Link href="/sermons" className={styles.navLink}>
            All sermons
          </Link>
          <CollectionShareButton />
        </nav>
      </div>
    </header>
  );
}

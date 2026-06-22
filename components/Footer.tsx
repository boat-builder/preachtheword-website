import Link from 'next/link';
import { SITE } from '@/lib/site';
import { THEMES } from '@/lib/sermons';
import { CollectionShareFooter } from './ShareControls';
import styles from './Footer.module.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div>
          <div className={styles.brand}>
            <span className={styles.mark}>
              <span className={styles.markRing} />
            </span>
            <span className={styles.brandName}>{SITE.name}</span>
          </div>
          <p className={styles.verse}>“{SITE.verse}”</p>
          <p className={styles.ref}>{SITE.reference}</p>
          <div className={styles.heading}>Contact</div>
          <a className={styles.contact} href={`mailto:${SITE.email}`}>
            {SITE.email}
          </a>
        </div>

        <div>
          <div className={styles.heading}>Themes</div>
          <nav className={styles.links}>
            {THEMES.map((t) => (
              <Link key={t.key} href={`/themes/${t.slug}`} className={styles.link}>
                {t.name}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <div className={styles.heading}>Share the library</div>
          <p className={styles.blurb}>
            Send the whole collection to someone who needs the Word.
          </p>
          <CollectionShareFooter />
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={`container ${styles.bottomInner}`}>
          <span>© {year} {SITE.name}</span>
          <a href={`mailto:${SITE.email}`} className={styles.bottomLink}>
            {SITE.email}
          </a>
        </div>
      </div>
    </footer>
  );
}

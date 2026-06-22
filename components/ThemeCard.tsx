import Link from 'next/link';
import { type Theme, themeCountLabel } from '@/lib/sermons';
import ThemeIcon from './ThemeIcon';
import styles from './ThemeCard.module.css';

export default function ThemeCard({ theme }: { theme: Theme }) {
  return (
    <Link href={`/themes/${theme.slug}`} className={styles.card}>
      <div className={styles.iconWrap}>
        <ThemeIcon theme={theme.key} />
      </div>
      <div className={styles.body}>
        <div className={styles.name}>{theme.name}</div>
        <div className={styles.blurb}>{theme.blurb}</div>
        <div className={styles.label}>
          {themeCountLabel(theme.key)} <span className={styles.arrow}>→</span>
        </div>
      </div>
    </Link>
  );
}

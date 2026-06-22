import type { Metadata } from 'next';
import { THEMES } from '@/lib/sermons';
import { SITE } from '@/lib/site';
import ThemeCard from '@/components/ThemeCard';
import styles from './themes.module.css';

export const metadata: Metadata = {
  title: 'Browse by theme',
  description:
    'Every message flows through one of five streams — mission, discipleship, future hope, salvation, and repentance. Choose the one that meets your need.',
  alternates: { canonical: '/themes' },
  openGraph: {
    title: `Browse by theme — ${SITE.name}`,
    description:
      'Five streams of gospel teaching: mission, discipleship, future hope, salvation, and repentance.',
    url: '/themes',
    siteName: SITE.name,
  },
};

export default function ThemesIndexPage() {
  return (
    <main className={`container viewIn ${styles.main}`}>
      <div className={styles.head}>
        <div className={styles.eyebrow}>Find a word for where you are</div>
        <h1 className={styles.title}>Browse by theme</h1>
        <p className={styles.lede}>
          Every message flows through one of five streams. Choose the one that
          meets your need and go straight to the sermons that speak to it.
        </p>
      </div>
      <div className={styles.grid}>
        {THEMES.map((theme) => (
          <ThemeCard key={theme.key} theme={theme} />
        ))}
      </div>
    </main>
  );
}

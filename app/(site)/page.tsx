import Link from 'next/link';
import Image from 'next/image';
import {
  THEMES,
  NEED_TAGS,
  featuredSermon,
  latestSermons,
  formatDate,
  thumbUrl,
} from '@/lib/sermons';
import { SITE } from '@/lib/site';
import SermonCard from '@/components/SermonCard';
import ThemeCard from '@/components/ThemeCard';
import { HeroShareButton } from '@/components/ShareControls';
import styles from './home.module.css';

export default function HomePage() {
  const featured = featuredSermon();
  const latest = latestSermons(featured.id);

  return (
    <main className="viewIn">
      {/* Welcome + featured hero */}
      <section className={`container ${styles.heroSection}`}>
        <div className={styles.welcome}>
          <div className={styles.eyebrow}>Proclaiming the Word of God</div>
          <p className={styles.lede}>
            A growing library of messages to <em>discover</em> a word for your
            need, grow in faith, and share with those you love.
          </p>
        </div>

        <div className={styles.hero}>
          <div className={styles.heroText}>
            <div className={styles.heroEyebrow}>Featured message</div>
            <h1 className={styles.heroTitle}>{featured.title}</h1>
            <div className={styles.heroMeta}>
              <span className={styles.heroRef}>{featured.ref}</span>
              <span className={styles.dot}>·</span>
              <span>{formatDate(featured.date)}</span>
            </div>
            <p className={styles.heroShort}>{featured.short}</p>
            <div className={styles.heroActions}>
              <Link href={`/sermons/${featured.slug}`} className={styles.watchBtn}>
                <span className={styles.watchGlyph} />
                Watch message
              </Link>
              <HeroShareButton slug={featured.slug} />
            </div>
          </div>
          <Link
            href={`/sermons/${featured.slug}`}
            className={styles.heroMedia}
            aria-label={`Watch “${featured.title}”`}
          >
            <Image
              src={thumbUrl(featured.videoId)}
              alt=""
              fill
              priority
              sizes="(max-width: 880px) 100vw, 560px"
              className={styles.heroImg}
            />
            <span className={styles.heroScrim} />
            <span className={styles.heroPlay}>
              <span className={styles.heroPlayGlyph} />
            </span>
          </Link>
        </div>
      </section>

      {/* Need tags */}
      <section className={`container ${styles.tagsSection}`}>
        <h2 className={styles.tagsHeading}>Looking for a word on…</h2>
        <div className={styles.tags}>
          {NEED_TAGS.map((tag) => (
            <Link
              key={tag}
              href={`/sermons?tag=${encodeURIComponent(tag)}`}
              className={styles.tag}
            >
              {tag}
            </Link>
          ))}
        </div>
      </section>

      {/* Themes */}
      <section className={styles.themesSection}>
        <div className={`container ${styles.themesInner}`}>
          <div className={styles.themesHead}>
            <div className={styles.eyebrow}>Find a word for where you are</div>
            <h2 className={styles.themesTitle}>Browse by theme</h2>
            <p className={styles.themesLede}>
              Every message flows through one of five streams. Choose the one
              that meets your need and go straight to the sermons that speak to
              it.
            </p>
          </div>
          <div className={styles.themesGrid}>
            {THEMES.map((theme) => (
              <ThemeCard key={theme.key} theme={theme} />
            ))}
          </div>
        </div>
      </section>

      {/* Latest */}
      <section className={`container ${styles.latestSection}`}>
        <div className={styles.latestHead}>
          <h2 className={styles.latestTitle}>Latest messages</h2>
          <Link href="/sermons" className={styles.viewAll}>
            View all →
          </Link>
        </div>
        <div className={styles.grid}>
          {latest.map((sermon) => (
            <SermonCard key={sermon.id} sermon={sermon} />
          ))}
        </div>
      </section>

      <p className="visually-hidden">{SITE.tagline}</p>
    </main>
  );
}

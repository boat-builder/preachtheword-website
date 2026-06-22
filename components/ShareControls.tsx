'use client';

import { useShare } from './useShare';
import { SITE, absoluteUrl } from '@/lib/site';
import styles from './ShareControls.module.css';

// ---------------------------------------------------------------------------
// Small "Share" pill used on sermon cards (copies the sermon link).
// ---------------------------------------------------------------------------
export function CardShareButton({ slug, title }: { slug: string; title: string }) {
  const share = useShare();
  const url = absoluteUrl(`/sermons/${slug}`);
  return (
    <button
      type="button"
      className={styles.cardShare}
      title="Copy link"
      aria-label={`Copy link to “${title}”`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        share.copy(url, 'Link copied to clipboard');
      }}
    >
      Share
    </button>
  );
}

// ---------------------------------------------------------------------------
// Featured hero "Share" (ghost button on navy).
// ---------------------------------------------------------------------------
export function HeroShareButton({ slug }: { slug: string }) {
  const share = useShare();
  const url = absoluteUrl(`/sermons/${slug}`);
  return (
    <button
      type="button"
      className={styles.heroGhost}
      onClick={() => share.copy(url, 'Link copied to clipboard')}
    >
      Share
    </button>
  );
}

// ---------------------------------------------------------------------------
// Full share row on the sermon detail page.
// ---------------------------------------------------------------------------
export function SermonShareRow({
  slug,
  title,
  short,
  watchUrl,
}: {
  slug: string;
  title: string;
  short: string;
  watchUrl: string;
}) {
  const share = useShare();
  const url = absoluteUrl(`/sermons/${slug}`);
  return (
    <div className={styles.shareRow}>
      <span className={styles.shareRowLabel}>Share this message</span>
      <button
        type="button"
        className={styles.lightBtn}
        onClick={() => share.copy(url, 'Link copied to clipboard')}
      >
        Copy link
      </button>
      <button
        type="button"
        className={styles.lightBtn}
        onClick={() => share.whatsapp(title, url)}
      >
        WhatsApp
      </button>
      <button
        type="button"
        className={styles.lightBtn}
        onClick={() =>
          share.email(`${title} — ${SITE.name}`, `${short}\n\nWatch & read: ${url}`)
        }
      >
        Email
      </button>
      <a
        className={styles.youtubeLink}
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open on YouTube ↗
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme hero share buttons (on navy).
// ---------------------------------------------------------------------------
export function ThemeShareButtons({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const share = useShare();
  const url = absoluteUrl(`/themes/${slug}`);
  return (
    <div className={styles.themeShare}>
      <span className={styles.themeShareLabel}>Share this theme</span>
      <button
        type="button"
        className={styles.navyGhost}
        onClick={() => share.copy(url, `${name} link copied`)}
      >
        Copy link
      </button>
      <button
        type="button"
        className={styles.navySolid}
        onClick={() => share.whatsapp(`Messages on ${name} — ${SITE.name}`, url)}
      >
        WhatsApp
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collection share — header button + footer cluster.
// ---------------------------------------------------------------------------
export function CollectionShareButton() {
  const share = useShare();
  return (
    <button
      type="button"
      className={styles.headerSolid}
      onClick={() => share.copy(SITE.url, 'Collection link copied')}
    >
      Share collection
    </button>
  );
}

export function CollectionShareFooter() {
  const share = useShare();
  return (
    <div className={styles.footerShare}>
      <button
        type="button"
        className={styles.footerSolid}
        onClick={() => share.copy(SITE.url, 'Collection link copied')}
      >
        Copy collection link
      </button>
      <button
        type="button"
        className={styles.footerGhost}
        onClick={() => share.whatsapp(`${SITE.name} — a library of messages`, SITE.url)}
      >
        Share on WhatsApp
      </button>
    </div>
  );
}

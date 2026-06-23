import Image from 'next/image';
import { PlusIcon, SearchIcon, StarIcon, TrashIcon } from './icons';
import styles from './admin.module.css';

export interface LibraryRow {
  id: string;
  title: string;
  ref: string;
  formattedDate: string;
  catName: string;
  thumb: string;
  short: string;
  featured: boolean;
  tagsShown: string[];
  tagsMore: string;
  hasMore: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onFeature: () => void;
}

export interface LibraryChip {
  key: string;
  name: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

interface LibraryViewProps {
  libCount: string;
  featuredTitle: string | null;
  query: string;
  onSearch: (value: string) => void;
  chips: LibraryChip[];
  rows: LibraryRow[];
  emptyTitle: string;
  emptySub: string;
  onStartAdd: () => void;
}

export default function LibraryView({
  libCount,
  featuredTitle,
  query,
  onSearch,
  chips,
  rows,
  emptyTitle,
  emptySub,
  onStartAdd,
}: LibraryViewProps) {
  return (
    <div className={`${styles.libWrap} ${styles.viewIn}`}>
      <div className={styles.libHead}>
        <div>
          <h1 className={styles.pageTitle}>Sermon library</h1>
          <p className={styles.pageSub}>{libCount}</p>
        </div>
        <button type="button" className={styles.headAdd} onClick={onStartAdd}>
          <PlusIcon />
          Add sermon
        </button>
      </div>

      {featuredTitle && (
        <div className={styles.featuredStrip}>
          <StarIcon size={17} fill="#1e50c8" />
          <span className={styles.featuredStripText}>
            Featured on the public site: <strong>{featuredTitle}</strong>
          </span>
          <span className={styles.featuredStripHint}>
            Use a sermon&rsquo;s <em>Make featured</em> action to change this.
          </span>
        </div>
      )}

      <div className={styles.searchWrap}>
        <SearchIcon className={styles.searchIcon} />
        <input
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by title, scripture, summary or tag…"
          className={`${styles.field} ${styles.searchInput}`}
          aria-label="Search the sermon library"
        />
      </div>

      <div className={styles.chips}>
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={c.onClick}
            className={`${styles.chip}${c.active ? ` ${styles.chipActive}` : ''}`}
          >
            {c.name} <span className={styles.chipCount}>{c.count}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>{emptyTitle}</div>
          <p className={styles.emptySub}>{emptySub}</p>
          <button type="button" className={styles.emptyBtn} onClick={onStartAdd}>
            Add a sermon
          </button>
        </div>
      ) : (
        <div className={styles.rows}>
          {rows.map((s) => (
            <div key={s.id} className={styles.row}>
              <div className={styles.thumb}>
                <Image src={s.thumb} alt="" fill sizes="142px" unoptimized />
                {s.featured && (
                  <div className={styles.thumbBadge}>
                    <StarIcon size={10} fill="#ffc857" />
                    FEATURED
                  </div>
                )}
              </div>

              <div className={styles.rowBody}>
                <div className={styles.rowMeta}>
                  <span className={styles.catTag}>{s.catName}</span>
                  <span className={styles.rowDate}>
                    {s.ref} · {s.formattedDate}
                  </span>
                </div>
                <h3 className={styles.rowTitle}>{s.title}</h3>
                <p className={styles.rowShort}>{s.short}</p>
                <div className={styles.rowTags}>
                  {s.tagsShown.map((t) => (
                    <span key={t} className={styles.rowTag}>
                      {t}
                    </span>
                  ))}
                  {s.hasMore && (
                    <span className={styles.rowTagsMore}>{s.tagsMore}</span>
                  )}
                </div>
              </div>

              <div className={styles.rowActions}>
                {s.featured ? (
                  <div className={styles.featuredBadge}>
                    <StarIcon size={13} fill="#1e50c8" />
                    Featured
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.featureBtn}
                    onClick={s.onFeature}
                  >
                    <StarIcon size={13} stroke="currentColor" />
                    Make featured
                  </button>
                )}
                <div className={styles.rowActionsBottom}>
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={s.onEdit}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={s.onDelete}
                    title="Remove"
                    aria-label={`Remove ${s.title}`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

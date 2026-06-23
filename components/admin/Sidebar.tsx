import Image from 'next/image';
import type { AdminView } from './types';
import { LibraryIcon, TagsIcon, PlusIcon } from './icons';
import styles from './admin.module.css';

interface SidebarProps {
  view: AdminView;
  email: string;
  initials: string;
  onGoLibrary: () => void;
  onGoTags: () => void;
  onStartAdd: () => void;
  onSignOut: () => void;
}

export default function Sidebar({
  view,
  email,
  initials,
  onGoLibrary,
  onGoTags,
  onStartAdd,
  onSignOut,
}: SidebarProps) {
  const navClass = (active: boolean) =>
    `${styles.navItem}${active ? ` ${styles.navItemActive}` : ''}`;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sideHead}>
        <Image
          src="/logo.png"
          alt=""
          width={36}
          height={36}
          className={styles.sideMark}
        />
        <div>
          <div className={styles.sideBrandName}>Preach the Word</div>
          <div className={styles.sideBrandSub}>Content admin</div>
        </div>
      </div>

      <nav className={styles.nav}>
        <button
          type="button"
          className={navClass(view === 'library' || view === 'form')}
          onClick={onGoLibrary}
        >
          <LibraryIcon />
          Sermon library
        </button>
        <button
          type="button"
          className={navClass(view === 'tags')}
          onClick={onGoTags}
        >
          <TagsIcon />
          Topic tags
        </button>
      </nav>

      <div className={styles.sideFoot}>
        <button type="button" className={styles.addBtn} onClick={onStartAdd}>
          <PlusIcon />
          Add sermon
        </button>
        <div className={styles.userRow}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.userMeta}>
            <div className={styles.userEmail}>{email}</div>
            <button type="button" className={styles.signOut} onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

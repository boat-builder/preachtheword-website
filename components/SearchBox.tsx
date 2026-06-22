'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import styles from './Header.module.css';

export default function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = searchParams.get('q') ?? '';
  const [value, setValue] = useState(initial);
  const dirty = useRef(false);

  // Keep the field in sync when the URL's q changes from elsewhere
  // (e.g. landing on a shared /sermons?q=… link), but never clobber typing.
  useEffect(() => {
    if (!dirty.current) setValue(initial);
  }, [initial]);

  // Debounced live navigation to the browse page as the user types.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => {
      const q = value.trim();
      router.push(q ? `/sermons?q=${encodeURIComponent(q)}` : '/sermons');
    }, 250);
    return () => clearTimeout(t);
  }, [value, router]);

  return (
    <form
      className={styles.search}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `/sermons?q=${encodeURIComponent(q)}` : '/sermons');
      }}
    >
      <svg
        className={styles.searchIcon}
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#9aa6c0"
        strokeWidth="2.2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" />
      </svg>
      <input
        className={styles.searchInput}
        type="search"
        value={value}
        onChange={(e) => {
          dirty.current = true;
          setValue(e.target.value);
        }}
        placeholder="Search messages, scripture, topics…"
        aria-label="Search messages"
        autoComplete="off"
        data-active-search={pathname === '/sermons' ? 'true' : undefined}
      />
    </form>
  );
}

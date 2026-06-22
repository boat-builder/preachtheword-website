'use client';

import { useState } from 'react';
import styles from './Transcript.module.css';

export default function Transcript({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.toggleLabel}>Read the full transcript</span>
        <span className={styles.toggleHint}>{open ? 'Hide ↑' : 'Show ↓'}</span>
      </button>
      {open && <div className={styles.body}>{text}</div>}
    </div>
  );
}

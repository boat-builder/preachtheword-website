import { formatDuration } from '@/lib/sermons';
import styles from './Duration.module.css';

/**
 * Small "⏱ 42:15" badge for a sermon's video length. Inherits the surrounding
 * text colour so it sits naturally inside meta rows on cards and the detail page.
 */
export default function Duration({
  seconds,
  className,
}: {
  seconds: number;
  className?: string;
}) {
  return (
    <span className={`${styles.duration}${className ? ` ${className}` : ''}`}>
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      {formatDuration(seconds)}
    </span>
  );
}

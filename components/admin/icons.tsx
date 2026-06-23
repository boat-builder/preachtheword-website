// Inline SVG icons used across the admin panel, ported from Admin.dc.html.
import type { CSSProperties } from 'react';

type IconProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
};

export function LibraryIcon({ size = 18, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M3 9h18M9 18v2M15 18v2" />
    </svg>
  );
}

export function TagsIcon({ size = 18, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d="M3 7v5l9 9 5-5-9-9H3z" />
      <circle cx="7" cy="11" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PlusIcon({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      className={className}
      style={style}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SearchIcon({ size = 17, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9aa6c0"
      strokeWidth={2.2}
      className={className}
      style={style}
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

export function TrashIcon({
  size = 15,
  className,
  style,
  stroke = 'currentColor',
}: IconProps & { stroke?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}

export function CheckIcon({
  size = 16,
  className,
  style,
  stroke = 'currentColor',
  strokeWidth = 2.6,
}: IconProps & { stroke?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function WarnIcon({
  size = 16,
  className,
  style,
  stroke = '#b8791c',
}: IconProps & { stroke?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  );
}

/** Five-point star. Pass fill for solid, or fill="none" with a stroke for outline. */
export function StarIcon({
  size = 13,
  className,
  style,
  fill = 'none',
  stroke = 'none',
  strokeWidth = 2,
}: IconProps & { fill?: string; stroke?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
    >
      <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7L12 2z" />
    </svg>
  );
}

import type { ThemeKey } from '@/lib/sermons';

const PATHS: Record<ThemeKey, React.ReactNode> = {
  mission: (
    <>
      <circle cx="24" cy="24" r="15" />
      <line x1="9" y1="24" x2="39" y2="24" />
      <path d="M24 9 C 15 15, 15 33, 24 39" />
      <path d="M24 9 C 33 15, 33 33, 24 39" />
    </>
  ),
  discipleship: (
    <>
      <polyline points="9,37 17,37 17,29 25,29 25,21 33,21 33,13 39,13" />
      <circle cx="39" cy="9" r="2.6" />
    </>
  ),
  future: (
    <>
      <line x1="8" y1="33" x2="40" y2="33" />
      <path d="M15 33 a9 9 0 0 1 18 0" />
      <line x1="24" y1="14" x2="24" y2="10" />
      <line x1="13" y1="20" x2="10.5" y2="17.5" />
      <line x1="35" y1="20" x2="37.5" y2="17.5" />
    </>
  ),
  salvation: (
    <>
      <path d="M14 39 L14 21 a10 10 0 0 1 20 0 L34 39" />
      <line x1="9" y1="39" x2="39" y2="39" />
      <circle cx="29" cy="26" r="1.5" fill="#1e50c8" stroke="none" />
    </>
  ),
  repentance: (
    <>
      <path d="M30 16 a11 11 0 1 0 6 9" />
      <line x1="30" y1="16" x2="25" y2="14.5" />
      <line x1="30" y1="16" x2="31.5" y2="21" />
    </>
  ),
};

export default function ThemeIcon({
  theme,
  size = 64,
}: {
  theme: ThemeKey;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="#1e50c8"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[theme]}
    </svg>
  );
}

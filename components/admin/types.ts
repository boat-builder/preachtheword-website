import type { ThemeKey } from '@/lib/admin';

export type AdminView = 'library' | 'form' | 'tags';

export interface FormState {
  id: string | null;
  videoUrl: string;
  videoId: string;
  thumb: string;
  title: string;
  short: string;
  longText: string;
  category: ThemeKey | '';
  tags: string[];
  ref: string;
  date: string;
  /** Human "mm:ss" / "h:mm:ss" text; parsed to durationSeconds on save. */
  duration: string;
  slug: string;
  transcript: string;
}

export type FormErrorKey =
  | 'video'
  | 'title'
  | 'short'
  | 'long'
  | 'category'
  | 'ref'
  | 'date'
  | 'duration'
  | 'slug'
  | 'tags';

export type FormErrors = Partial<Record<FormErrorKey, string>>;

export type ModalKind = 'danger' | 'warn' | 'info';

export interface ModalState {
  kind: ModalKind;
  title: string;
  body: string;
  confirm: string;
  /** Single-action modal (just an acknowledgement, no Cancel). */
  single?: boolean;
  /**
   * When deleting the featured sermon, the operator must pick a replacement hero.
   * If present, the modal renders a <select> of these options (see AdminApp).
   */
  replacementOptions?: { id: string; title: string }[];
  onConfirm?: () => void;
}

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
  | 'slug';

export type FormErrors = Partial<Record<FormErrorKey, string>>;

export type ModalKind = 'danger' | 'warn' | 'info';

export interface ModalState {
  kind: ModalKind;
  title: string;
  body: string;
  confirm: string;
  /** Single-action modal (just an acknowledgement, no Cancel). */
  single?: boolean;
  onConfirm?: () => void;
}

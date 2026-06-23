'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import { THEMES, formatAdminDate, todayIso, type ThemeKey } from '@/lib/admin';
// Use the canonical slugifier the server uses, so client preview/validation and
// the stored slug always agree (transliterates accents, drops apostrophes).
import { slugify } from '@/lib/admin/slugify';
import { themeName, thumbUrl, watchUrl } from '@/lib/sermons';
import type { ContentFile, SermonRecord, ReleaseStatus } from '@/lib/admin/types';
import type { SermonInput } from '@/lib/admin/validation';
import {
  createSermon,
  updateSermon,
  deleteSermon,
  setFeaturedSermon,
  createTag,
  renameTag,
  setTagRetired,
  deleteTag,
  getContent,
  getReleaseStatus,
} from '@/lib/admin/actions';
import type { AdminView, FormErrors, FormState, ModalState } from './types';
import Sidebar from './Sidebar';
import LibraryView, { type LibraryChip, type LibraryRow } from './LibraryView';
import SermonForm, { type ThemeOption, type TagOption } from './SermonForm';
import TagsView, { type TagRow } from './TagsView';
import { CheckIcon, TrashIcon, WarnIcon } from './icons';
import styles from './admin.module.css';

type ThemeFilter = 'all' | ThemeKey;

export interface AdminAppProps {
  /** Live content loaded server-side (lib/admin/read.ts#getAdminContent). */
  initialContent: ContentFile;
  /** Signed-in operator (resolved server-side from Clerk). */
  operator: { name: string; email: string };
}

export default function AdminApp({ initialContent, operator }: AdminAppProps) {
  const { signOut } = useClerk();

  const [view, setView] = useState<AdminView>('library');

  // The content store. Seeded from the server, re-synced after every write.
  const [content, setContent] = useState<ContentFile>(initialContent);
  const sermons = content.sermons;
  const tags = content.tags;
  const tagLabel = useMemo(
    () => new Map(tags.map((t) => [t.id, t.label] as const)),
    [tags],
  );

  // Library
  const [query, setQuery] = useState('');
  const [themeFilter, setThemeFilter] = useState<ThemeFilter>('all');

  // Form
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [origSlug, setOrigSlug] = useState<string | null>(null);
  const [fetchMsg, setFetchMsg] = useState('');
  const [fetchKind, setFetchKind] = useState<'' | 'ok' | 'err'>('');
  // Whether the operator has hand-edited the slug (so a later title edit won't
  // clobber their custom web address while adding).
  const [slugTouched, setSlugTouched] = useState(false);

  // Tags view
  const [tagEdit, setTagEdit] = useState<string | null>(null); // tag id
  const [tagEditVal, setTagEditVal] = useState('');
  const [newTag, setNewTag] = useState('');
  const [tagErr, setTagErr] = useState('');

  // Overlays
  const [modal, setModal] = useState<ModalState | null>(null);
  const [modalError, setModalError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [toastSeq, setToastSeq] = useState(0);
  const [busy, setBusy] = useState(false);

  // Live release status (polled). While a deploy is building we pause mutations so
  // an operator can't stack up several rebuilds from rapid saves.
  const [release, setRelease] = useState<ReleaseStatus | null>(null);
  const isReleasing = release?.state === 'building';

  // Delete-featured flow: which sermon is being deleted, and the chosen replacement
  // hero. Kept as state (not a closure-captured value) so the confirm handler always
  // reads the current <select> choice.
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReplacement, setDeleteReplacement] = useState('');

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast, toastSeq]);

  // Poll release status: on mount and every 15s. Fail-open — a failed check
  // leaves the previous status, so a GitHub hiccup never permanently blocks edits.
  const checkRelease = useCallback(async () => {
    const res = await getReleaseStatus();
    if (res.ok) setRelease(res.data);
  }, []);

  useEffect(() => {
    // Initial check via a timer callback (not a synchronous effect-body setState).
    const first = setTimeout(() => void checkRelease(), 0);
    const id = setInterval(() => void checkRelease(), 15000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [checkRelease]);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const scrollTop = () => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };
  const toastMsg = (m: string) => {
    setToast(m);
    setToastSeq((n) => n + 1);
  };
  /** Block a mutation while a release is building; returns true if blocked. */
  const guardRelease = (): boolean => {
    if (isReleasing) {
      toastMsg(
        'A release is already in progress — your last change is going live. Please wait a moment.',
      );
      return true;
    }
    return false;
  };
  const openModal = (m: ModalState) => {
    setModalError('');
    setModal(m);
  };
  const closeModal = () => {
    setModalError('');
    setModal(null);
  };

  /**
   * Run a mutation with the `busy` flag set (drives disabled buttons), always
   * cleared in finally. Re-entrancy is already prevented two ways: every trigger
   * button is disabled={busy}, and the backend's optimistic-concurrency (sha) +
   * slug-uniqueness reject a duplicate commit, so a sub-frame double-click can't
   * create a duplicate sermon.
   */
  const exclusive = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  /**
   * Re-sync the content store from the server after a write. Returns false if the
   * re-read failed (the write itself still committed) so callers can warn instead
   * of falsely implying the on-screen list is up to date.
   */
  const refresh = async (): Promise<boolean> => {
    const res = await getContent();
    if (res.ok) {
      setContent(res.data);
      return true;
    }
    return false;
  };

  /** Map server fieldErrors (SermonInput keys) onto the form's error keys. */
  const applyServerFieldErrors = (fieldErrors?: Record<string, string[]>) => {
    if (!fieldErrors) return;
    const map: Record<string, keyof FormErrors> = {
      videoId: 'video',
      title: 'title',
      short: 'short',
      long: 'long',
      category: 'category',
      ref: 'ref',
      date: 'date',
      slug: 'slug',
      tags: 'tags',
    };
    const next: FormErrors = {};
    for (const [key, msgs] of Object.entries(fieldErrors)) {
      const mapped = map[key];
      if (mapped) next[mapped] = msgs[0];
    }
    setErrors((e) => ({ ...e, ...next }));
  };

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------
  const goLibrary = () => {
    setView('library');
    scrollTop();
  };
  const goTags = () => {
    setView('tags');
    setTagErr('');
    setTagEdit(null);
    scrollTop();
  };

  // -------------------------------------------------------------------------
  // Form
  // -------------------------------------------------------------------------
  const blankForm = (): FormState => ({
    id: null,
    videoUrl: '',
    videoId: '',
    thumb: '',
    title: '',
    short: '',
    longText: '',
    category: '',
    tags: [],
    ref: '',
    date: todayIso(),
    slug: '',
    transcript: '',
  });

  const toForm = (s: SermonRecord): FormState => ({
    id: s.id,
    videoUrl: watchUrl(s.videoId),
    videoId: s.videoId,
    thumb: thumbUrl(s.videoId),
    title: s.title,
    short: s.short,
    longText: s.long.join('\n\n'),
    category: s.category,
    tags: [...s.tags], // tag ids
    ref: s.ref,
    date: s.date,
    slug: s.slug,
    transcript: s.transcript || '',
  });

  const startAdd = () => {
    setFormMode('add');
    setForm(blankForm());
    setErrors({});
    setOrigSlug(null);
    setSlugTouched(false);
    setFetchMsg('');
    setFetchKind('');
    setView('form');
    scrollTop();
  };

  const startEdit = (id: string) => {
    const s = sermons.find((x) => x.id === id);
    if (!s) return;
    setFormMode('edit');
    setForm(toForm(s));
    setErrors({});
    setOrigSlug(s.slug);
    setSlugTouched(true); // never auto-derive an existing sermon's slug
    setFetchMsg('');
    setFetchKind('');
    setView('form');
    scrollTop();
  };

  const cancelForm = () => setView('library');

  const setField = (key: keyof FormState, value: string) => {
    if (key === 'slug') setSlugTouched(true);
    setForm((f) => {
      if (!f) return f;
      const next: FormState = { ...f, [key]: value };
      // Auto-suggest the slug from the title only while adding AND only until the
      // operator hand-edits it (never re-derive an existing sermon's slug — that's
      // destructive, spec §2.3).
      if (key === 'title' && formMode === 'add' && !slugTouched) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  // Pull title/thumbnail (+ date when a Data API key is set) from the real
  // /api/admin/youtube endpoint (spec §4).
  const fetchDetails = async () => {
    if (!form) return;
    setFetchKind('');
    setFetchMsg('Looking up the video…');
    try {
      const res = await fetch(
        `/api/admin/youtube?url=${encodeURIComponent(form.videoUrl)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setFetchKind('err');
        setFetchMsg(
          data?.error ||
            'That doesn’t look like a valid video link. Paste a YouTube link or 11-character ID.',
        );
        return;
      }
      const filledTitle = !form.title && !!data.title;
      const filledDate = !!data.date && formMode === 'add';
      setForm((f) => {
        if (!f) return f;
        const next: FormState = {
          ...f,
          videoId: data.videoId,
          thumb: data.thumbnailUrl || thumbUrl(data.videoId),
        };
        if (filledTitle) {
          next.title = data.title;
          if (!slugTouched) next.slug = slugify(data.title);
        }
        if (filledDate) next.date = data.date;
        return next;
      });
      setFetchKind('ok');
      const filled = [
        filledTitle ? 'title' : '',
        filledDate ? 'date' : '',
      ].filter(Boolean);
      setFetchMsg(
        `Video found. Preview image${
          filled.length ? ' and ' + filled.join(' and ') : ''
        } filled in from the video.`,
      );
    } catch {
      setFetchKind('err');
      setFetchMsg('Could not reach the video service. Please try again.');
    }
  };

  const toggleFormTag = (tagId: string) => {
    setForm((f) => {
      if (!f) return f;
      const cur = [...f.tags];
      const i = cur.indexOf(tagId);
      if (i < 0) cur.push(tagId);
      else cur.splice(i, 1);
      return { ...f, tags: cur };
    });
  };

  // Light client-side validation for instant feedback; the server is authoritative.
  const validate = (f: FormState): FormErrors => {
    const e: FormErrors = {};
    if (!f.videoId) e.video = 'Add a video link and fetch its details.';
    if (!f.title.trim()) e.title = 'A title is required.';
    if (!f.short.trim()) e.short = 'A short summary is required.';
    if (!f.longText.trim())
      e.long = 'Add at least one paragraph for the full message.';
    if (!f.category) e.category = 'Choose one theme.';
    if (!f.ref.trim()) e.ref = 'Add a scripture reference.';
    if (!f.date) e.date = 'Set the date of the sermon.';
    const slug = slugify(f.slug || f.title);
    if (!slug) e.slug = 'A web address is required.';
    else {
      const clash = sermons.find((s) => s.slug === slug && s.id !== f.id);
      if (clash)
        e.slug = `That web address is already used by “${clash.title}”. Choose a different one.`;
    }
    return e;
  };

  const buildInput = (f: FormState): SermonInput => ({
    videoId: f.videoId || f.videoUrl,
    title: f.title.trim(),
    short: f.short.trim(),
    long: f.longText, // server splits paragraphs on blank lines
    transcript: f.transcript,
    tags: f.tags, // tag ids
    category: f.category as ThemeKey,
    // Normalize the slug exactly as the server does, so the client never sends a
    // value the server will reject. Omitting it lets the server auto-generate.
    slug: slugify(f.slug) || undefined,
    date: f.date,
    ref: f.ref.trim(),
    // `featured` intentionally omitted: the form has no featured control, so it
    // carries no feature/un-feature intent. The server preserves the current flag
    // on edit (tri-state) — no stale-snapshot un-feature.
  });

  const commitSave = async () => {
    if (!form || guardRelease()) return;
    const f = form;
    const input = buildInput(f);

    await exclusive(async () => {
      if (formMode === 'add') {
        const res = await createSermon(input);
        if (!res.ok) {
          applyServerFieldErrors(res.fieldErrors);
          toastMsg(res.error || 'Could not save. Please try again.');
          return;
        }
        const synced = await refresh();
        setView('library');
        void checkRelease(); // the commit kicked off a build — reflect it promptly
        toastMsg(synced ? 'Sermon added' : 'Saved — reload to see the updated list.');
      } else {
        const res = await updateSermon(f.id as string, input);
        if (!res.ok) {
          applyServerFieldErrors(res.fieldErrors);
          toastMsg(res.error || 'Could not save. Please try again.');
          return;
        }
        const synced = await refresh();
        setView('library');
        void checkRelease();
        const slugNote = res.data.slugChanged
          ? ' The old web address now redirects to the new one.'
          : '';
        toastMsg(
          synced
            ? `Changes saved.${slugNote}`
            : `Saved — reload to see the latest.${slugNote}`,
        );
      }
    });
  };

  const trySave = () => {
    if (!form || guardRelease()) return;
    const e = validate(form);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});
    const slug = slugify(form.slug || form.title);
    const slugChanged = formMode === 'edit' && !!origSlug && slug !== origSlug;
    if (slugChanged) {
      openModal({
        kind: 'warn',
        title: 'Change the web address?',
        body: 'This sermon is already public at its current address. Changing it breaks any links people have already shared — the old link will redirect to the new one.',
        confirm: 'Change address & save',
        onConfirm: () => {
          closeModal();
          void commitSave();
        },
      });
      return;
    }
    void commitSave();
  };

  // -------------------------------------------------------------------------
  // Feature / delete
  // -------------------------------------------------------------------------
  const askFeature = (id: string) => {
    const s = sermons.find((x) => x.id === id);
    if (!s || s.featured || guardRelease()) return;
    const cur = sermons.find((x) => x.featured);
    openModal({
      kind: 'warn',
      title: 'Make this the featured sermon?',
      body:
        `“${s.title}” will be highlighted at the top of the public site.` +
        (cur
          ? ` It replaces “${cur.title}” — there is only ever one featured sermon.`
          : ''),
      confirm: 'Feature this sermon',
      onConfirm: () =>
        exclusive(async () => {
          closeModal();
          const res = await setFeaturedSermon(id);
          if (!res.ok) {
            toastMsg(res.error || 'Could not update the featured sermon.');
            return;
          }
          const synced = await refresh();
          void checkRelease();
          toastMsg(
            synced ? 'Featured sermon updated' : 'Saved — reload to see the latest.',
          );
        }),
    });
  };

  // Delete a non-featured sermon (no replacement needed).
  const runDelete = (id: string, title: string) =>
    exclusive(async () => {
      const res = await deleteSermon(id);
      if (!res.ok) {
        setModalError(res.error || 'Could not remove the sermon.');
        return; // keep the modal open
      }
      closeModal();
      const synced = await refresh();
      void checkRelease();
      toastMsg(synced ? 'Sermon removed' : 'Removed — reload to see the latest.');
    });

  // Confirm handler for the featured-delete modal — reads the current replacement
  // choice from state (not a stale closure), then deletes with it.
  const confirmFeaturedDelete = () =>
    exclusive(async () => {
      const id = deleteTargetId;
      if (!id) return;
      const target = sermons.find((s) => s.id === id);
      const res = await deleteSermon(id, deleteReplacement || undefined);
      if (!res.ok) {
        // e.g. replacement vanished — surface it inline and keep the modal open.
        setModalError(
          res.fieldErrors?.replacementFeaturedId?.[0] ||
            res.error ||
            'Could not remove the sermon.',
        );
        return;
      }
      closeModal();
      setDeleteTargetId(null);
      const synced = await refresh();
      void checkRelease();
      toastMsg(synced ? 'Sermon removed' : 'Removed — reload to see the latest.');
    });

  const askDelete = (id: string) => {
    const s = sermons.find((x) => x.id === id);
    if (!s || guardRelease()) return;
    const others = sermons.filter((x) => x.id !== id);

    // The site needs at least one sermon (home hero) — block the last delete.
    if (others.length === 0) {
      openModal({
        kind: 'info',
        single: true,
        title: 'You can’t remove the last sermon',
        body: 'The site needs at least one message for the home page. Add another sermon before removing this one.',
        confirm: 'Got it',
      });
      return;
    }

    const needsReplacement = !!s.featured; // others.length > 0 guaranteed here

    let body = `Removing “${s.title}” takes it off the public site immediately. Anyone who saved or shared its link will no longer find it. This can’t be undone.`;
    if (needsReplacement) {
      // Pre-select the newest remaining sermon (operator can change it).
      const newest = [...others].sort(
        (a, b) => +new Date(b.date) - +new Date(a.date),
      )[0];
      setDeleteReplacement(newest?.id ?? '');
      setDeleteTargetId(id);
      body +=
        ' Because it’s the featured sermon, choose which sermon should be featured in its place.';
    }

    openModal({
      kind: 'danger',
      title: 'Remove this sermon?',
      body,
      confirm: 'Remove sermon',
      replacementOptions: needsReplacement
        ? others.map((o) => ({ id: o.id, title: o.title }))
        : undefined,
      // Featured deletes are confirmed via confirmFeaturedDelete (it reads the live
      // replacement choice); non-featured deletes use this closure directly.
      onConfirm: needsReplacement ? undefined : () => void runDelete(id, s.title),
    });
  };

  // -------------------------------------------------------------------------
  // Tags
  // -------------------------------------------------------------------------
  const tagUsage = (id: string) =>
    sermons.filter((s) => s.tags.includes(id)).length;

  const addTag = async () => {
    const n = newTag.trim();
    if (!n || guardRelease()) return;
    await exclusive(async () => {
      const res = await createTag(n);
      if (!res.ok) {
        setTagErr(res.fieldErrors?.label?.[0] || res.error || 'Could not add tag.');
        return;
      }
      const synced = await refresh();
      setNewTag('');
      setTagErr('');
      toastMsg(synced ? 'Tag added' : 'Added — reload to see the latest.');
    });
  };

  const startTagEdit = (id: string) => {
    setTagEdit(id);
    setTagEditVal(tagLabel.get(id) ?? '');
    setTagErr('');
  };
  const cancelTagEdit = () => {
    setTagEdit(null);
    setTagEditVal('');
  };
  const saveTagEdit = async () => {
    const id = tagEdit;
    if (!id) return;
    const nn = tagEditVal.trim();
    if (!nn || nn === tagLabel.get(id)) {
      cancelTagEdit();
      return;
    }
    if (guardRelease()) return;
    await exclusive(async () => {
      const res = await renameTag(id, nn);
      if (!res.ok) {
        setTagErr(
          res.fieldErrors?.label?.[0] || res.error || 'Could not rename tag.',
        );
        return;
      }
      const synced = await refresh();
      cancelTagEdit();
      setTagErr('');
      toastMsg(synced ? 'Tag renamed' : 'Renamed — reload to see the latest.');
    });
  };

  const doRetire = (id: string, retired: boolean) => () =>
    exclusive(async () => {
      closeModal();
      const res = await setTagRetired(id, retired);
      if (!res.ok) {
        toastMsg(res.error || 'Could not update the tag.');
        return;
      }
      const synced = await refresh();
      const done = retired ? 'Tag retired' : 'Tag restored';
      toastMsg(synced ? done : `${done} — reload to see the latest.`);
    });

  const askRetireTag = (id: string) => {
    if (guardRelease()) return;
    const label = tagLabel.get(id) ?? '';
    const n = tagUsage(id);
    openModal({
      kind: 'warn',
      title: 'Retire this tag?',
      body:
        `“${label}” will be hidden from the tag picker and the home-page chips.` +
        (n > 0
          ? ` It stays on the ${n} sermon${n === 1 ? '' : 's'} already using it.`
          : ''),
      confirm: 'Retire tag',
      onConfirm: doRetire(id, true),
    });
  };

  const restoreTag = (id: string) => {
    if (guardRelease()) return;
    void doRetire(id, false)();
  };

  const askDeleteTag = (id: string) => {
    if (guardRelease()) return;
    const label = tagLabel.get(id) ?? '';
    openModal({
      kind: 'danger',
      title: 'Delete this tag?',
      body: `“${label}” isn’t used by any sermon. Deleting removes it permanently. This can’t be undone.`,
      confirm: 'Delete tag',
      onConfirm: () =>
        exclusive(async () => {
          closeModal();
          const res = await deleteTag(id);
          if (!res.ok) {
            toastMsg(res.error || 'Could not delete the tag.');
            return;
          }
          const synced = await refresh();
          toastMsg(synced ? 'Tag deleted' : 'Deleted — reload to see the latest.');
        }),
    });
  };

  // -------------------------------------------------------------------------
  // Derived view data
  // -------------------------------------------------------------------------
  const featured = sermons.find((s) => s.featured);

  let list = [...sermons];
  if (themeFilter !== 'all')
    list = list.filter((s) => s.category === themeFilter);
  const q = query.trim().toLowerCase();
  if (q)
    list = list.filter((s) =>
      `${s.title} ${s.ref} ${s.short} ${s.tags
        .map((id) => tagLabel.get(id) ?? '')
        .join(' ')} ${themeName(s.category)}`
        .toLowerCase()
        .includes(q),
    );
  list.sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const labelsFor = (ids: string[]) =>
    ids.map((id) => tagLabel.get(id) ?? id).filter(Boolean);

  const rows: LibraryRow[] = list.map((s) => {
    const labels = labelsFor(s.tags);
    return {
      id: s.id,
      title: s.title,
      ref: s.ref,
      formattedDate: formatAdminDate(s.date),
      catName: themeName(s.category),
      thumb: thumbUrl(s.videoId),
      short: s.short,
      featured: !!s.featured,
      tagsShown: labels.slice(0, 3),
      tagsMore: labels.length > 3 ? `+${labels.length - 3} more` : '',
      hasMore: labels.length > 3,
      onEdit: () => startEdit(s.id),
      onDelete: () => askDelete(s.id),
      onFeature: () => askFeature(s.id),
    };
  });

  const chips: LibraryChip[] = [
    { key: 'all', name: 'All themes', count: sermons.length },
    ...THEMES.map((t) => ({
      key: t.key,
      name: t.name,
      count: sermons.filter((s) => s.category === t.key).length,
    })),
  ].map((c) => ({
    ...c,
    active: themeFilter === c.key,
    onClick: () => setThemeFilter(c.key as ThemeFilter),
  }));

  const total = sermons.length;
  let emptyTitle = 'No sermons match';
  let emptySub = 'Try another search, or clear the theme filter.';
  if (themeFilter !== 'all' && !q) {
    emptyTitle = 'Nothing in this theme yet';
    emptySub = `No sermons have been added under ${themeName(themeFilter)} so far.`;
  }
  if (total === 0) {
    emptyTitle = 'Your library is empty';
    emptySub = 'Add your first sermon to get started.';
  }

  const libCount = `${total} sermon${total === 1 ? '' : 's'} in the library`;

  const themeOptions: ThemeOption[] = THEMES.map((t) => ({
    key: t.key,
    name: t.name,
    selected: !!form && form.category === t.key,
    onSelect: () => setField('category', t.key),
  }));

  // Pick-list: non-retired tags, plus any retired tag already on this sermon (so
  // it stays visible/removable but can't be newly added — matches the backend).
  const tagOptions: TagOption[] = tags
    .filter((t) => !t.retired || (!!form && form.tags.includes(t.id)))
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((t) => ({
      id: t.id,
      name: t.label,
      selected: !!form && form.tags.includes(t.id),
      onToggle: () => toggleFormTag(t.id),
    }));

  const tagRows: TagRow[] = tags
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((t) => {
      const n = tagUsage(t.id);
      return {
        id: t.id,
        name: t.label,
        usageLabel: n === 0 ? 'Not in use' : `${n} sermon${n === 1 ? '' : 's'}`,
        retired: !!t.retired,
        canDelete: n === 0,
        editing: tagEdit === t.id,
        onEdit: () => startTagEdit(t.id),
        onRetire: () => askRetireTag(t.id),
        onRestore: () => restoreTag(t.id),
        onDelete: () => askDeleteTag(t.id),
      };
    });

  const initials = (operator.name || operator.email || 'O')
    .trim()
    .charAt(0)
    .toUpperCase();

  const handleSignOut = () => {
    void signOut({ redirectUrl: '/admin/sign-in' });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const isDanger = modal?.kind === 'danger';

  return (
    <div className={styles.root}>
      <div className={styles.shell}>
        <Sidebar
          view={view}
          email={operator.email}
          initials={initials}
          onGoLibrary={goLibrary}
          onGoTags={goTags}
          onStartAdd={startAdd}
          onSignOut={handleSignOut}
        />

        <main className={styles.main}>
          {release && (release.state === 'building' || release.state === 'error') && (
            <div className={styles.banner}>
              {release.state === 'building' && <span className={styles.bannerBar} />}
              <span className={styles.bannerDot} />
              <span className={styles.bannerText}>
                {release.state === 'building'
                  ? 'Releasing your latest change — it’ll be live in a minute or two. New edits are paused until this finishes.'
                  : 'The last release didn’t finish. Check the deployment, then try saving again.'}
              </span>
              <a
                className={styles.bannerDismiss}
                href={release.commitUrl}
                target="_blank"
                rel="noreferrer"
              >
                View commit
              </a>
            </div>
          )}

          {view === 'library' && (
            <LibraryView
              libCount={libCount}
              featuredTitle={featured ? featured.title : null}
              query={query}
              onSearch={setQuery}
              chips={chips}
              rows={rows}
              emptyTitle={emptyTitle}
              emptySub={emptySub}
              onStartAdd={startAdd}
            />
          )}

          {view === 'form' && form && (
            <SermonForm
              form={form}
              errors={errors}
              isEdit={formMode === 'edit'}
              heading={formMode === 'add' ? 'Add a sermon' : 'Edit sermon'}
              saveLabel={formMode === 'add' ? 'Save & publish' : 'Save changes'}
              fetchKind={fetchKind}
              fetchMsg={fetchMsg}
              busy={busy}
              releasing={isReleasing}
              themeOptions={themeOptions}
              tagOptions={tagOptions}
              selectedCount={form.tags.length}
              onField={setField}
              onFetch={fetchDetails}
              onSave={trySave}
              onCancel={cancelForm}
              onGoTags={goTags}
            />
          )}

          {view === 'tags' && (
            <TagsView
              tagRows={tagRows}
              newTag={newTag}
              tagErr={tagErr}
              tagEditVal={tagEditVal}
              onNewTag={(v) => {
                setNewTag(v);
                setTagErr('');
              }}
              onAddTag={addTag}
              onTagEditVal={setTagEditVal}
              onSaveTagEdit={saveTagEdit}
              onCancelTagEdit={cancelTagEdit}
            />
          )}
        </main>
      </div>

      {/* Modal */}
      {modal && (
        <div
          className={styles.modalOverlay}
          onClick={closeModal}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={modal.title}
          >
            <div
              className={`${styles.modalIcon} ${
                isDanger ? styles.modalIconDanger : styles.modalIconInfo
              }`}
            >
              {isDanger ? (
                <TrashIcon size={22} stroke="#c5392b" />
              ) : (
                <WarnIcon size={22} stroke="#1e50c8" />
              )}
            </div>
            <h2 className={styles.modalTitle}>{modal.title}</h2>
            <p className={styles.modalBody}>{modal.body}</p>
            {modal.replacementOptions && (
              <select
                className={styles.field}
                value={deleteReplacement}
                onChange={(e) => setDeleteReplacement(e.target.value)}
                aria-label="Replacement featured sermon"
              >
                {modal.replacementOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </select>
            )}
            {modalError && (
              <div className={styles.errText} style={{ marginTop: 8 }}>
                {modalError}
              </div>
            )}
            <div className={styles.modalActions}>
              {!modal.single && (
                <button
                  type="button"
                  className={styles.modalCancel}
                  onClick={closeModal}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className={`${styles.modalConfirm}${
                  isDanger ? ` ${styles.modalConfirmDanger}` : ''
                }`}
                disabled={busy || (isReleasing && !modal.single)}
                onClick={() => {
                  if (modal.replacementOptions) void confirmFeaturedDelete();
                  else if (modal.onConfirm) modal.onConfirm();
                  else closeModal();
                }}
              >
                {modal.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          <CheckIcon size={16} stroke="#5b8def" />
          {toast}
        </div>
      )}
    </div>
  );
}

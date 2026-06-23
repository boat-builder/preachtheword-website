'use client';

import { useEffect, useState } from 'react';
import {
  ADMIN_SEED_TAGS,
  THEMES,
  formatAdminDate,
  knownVideoTitle,
  parseVideoId,
  seedSermons,
  slugify,
  todayIso,
  type Sermon,
  type ThemeKey,
} from '@/lib/admin';
import { themeName, thumbUrl, watchUrl } from '@/lib/sermons';
import type { AdminView, FormErrors, FormState, ModalState } from './types';
import SignIn from './SignIn';
import Sidebar from './Sidebar';
import LibraryView, { type LibraryChip, type LibraryRow } from './LibraryView';
import SermonForm, { type ThemeOption, type TagOption } from './SermonForm';
import TagsView, { type TagRow } from './TagsView';
import { CheckIcon, TrashIcon, WarnIcon } from './icons';
import styles from './admin.module.css';

type ThemeFilter = 'all' | ThemeKey;

// Monotonic id source for sermons created this session. A counter (rather than
// Date.now()) keeps the component render-pure; the API will own real ids later.
let newSermonSeq = 0;
const makeSermonId = () => `s-new-${(newSermonSeq += 1)}`;

export default function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState<AdminView>('library');

  // Sign in
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [signinErr, setSigninErr] = useState('');

  // Library
  const [query, setQuery] = useState('');
  const [themeFilter, setThemeFilter] = useState<ThemeFilter>('all');

  // Data (in-memory until the API is wired up)
  const [sermons, setSermons] = useState<Sermon[]>(() => seedSermons());
  const [tags, setTags] = useState<string[]>(() => [...ADMIN_SEED_TAGS]);

  // Form
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [origSlug, setOrigSlug] = useState<string | null>(null);
  const [fetchMsg, setFetchMsg] = useState('');
  const [fetchKind, setFetchKind] = useState<'' | 'ok' | 'err'>('');

  // Tags view
  const [tagEdit, setTagEdit] = useState<string | null>(null);
  const [tagEditVal, setTagEditVal] = useState('');
  const [newTag, setNewTag] = useState('');
  const [tagErr, setTagErr] = useState('');

  // Overlays
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastSeq, setToastSeq] = useState(0);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [pubSeq, setPubSeq] = useState(0);

  // Auto-dismiss the toast and the publishing banner. Driven by effects (rather
  // than timer refs) so the action handlers stay free of render-time ref reads.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast, toastSeq]);

  useEffect(() => {
    if (!publishing) return;
    const id = setTimeout(() => setPublishing(null), 9000);
    return () => clearTimeout(id);
  }, [publishing, pubSeq]);

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

  const publish = (m: string) => {
    setPublishing(m);
    setPubSeq((n) => n + 1);
  };

  const openModal = (m: ModalState) => setModal(m);
  const closeModal = () => setModal(null);

  // -------------------------------------------------------------------------
  // Navigation / auth
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
  const signIn = () => {
    if (!email.trim()) {
      setSigninErr('Enter your email to continue.');
      return;
    }
    setAuthed(true);
    setView('library');
    setSigninErr('');
    setPass('');
  };
  const signOut = () => {
    setAuthed(false);
    setView('library');
    setEmail('');
    setPass('');
    setQuery('');
    setThemeFilter('all');
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

  const toForm = (s: Sermon): FormState => ({
    id: s.id,
    videoUrl: watchUrl(s.videoId),
    videoId: s.videoId,
    thumb: thumbUrl(s.videoId),
    title: s.title,
    short: s.short,
    longText: s.long.join('\n\n'),
    category: s.category,
    tags: [...s.tags],
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
    setFetchMsg('');
    setFetchKind('');
    setView('form');
    scrollTop();
  };

  const cancelForm = () => setView('library');

  const setField = (key: keyof FormState, value: string) => {
    setForm((f) => {
      if (!f) return f;
      const next: FormState = { ...f, [key]: value };
      if (key === 'title' && formMode === 'add') next.slug = slugify(value);
      return next;
    });
  };

  const fetchDetails = () => {
    if (!form) return;
    const id = parseVideoId(form.videoUrl);
    if (!id) {
      setFetchKind('err');
      setFetchMsg(
        'That doesn’t look like a valid video link. Paste a YouTube link or 11-character ID.',
      );
      return;
    }
    const known = knownVideoTitle(id);
    const willFillTitle = !form.title && !!known;
    setForm((f) => {
      if (!f) return f;
      const next: FormState = { ...f, videoId: id, thumb: thumbUrl(id) };
      if (!f.title && known) {
        next.title = known;
        next.slug = slugify(known);
      }
      return next;
    });
    setFetchKind('ok');
    setFetchMsg(
      `Video found. Preview image${
        willFillTitle ? ' and title' : ''
      } filled in from the video.`,
    );
  };

  const toggleFormTag = (tag: string) => {
    setForm((f) => {
      if (!f) return f;
      const cur = [...f.tags];
      const i = cur.indexOf(tag);
      if (i < 0) cur.push(tag);
      else cur.splice(i, 1);
      return { ...f, tags: cur };
    });
  };

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

  const commitSave = () => {
    if (!form) return;
    const f = form;
    const slug = slugify(f.slug || f.title);
    const long = f.longText
      .split(/\n\s*\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    if (formMode === 'add') {
      const created: Sermon = {
        id: makeSermonId(),
        slug,
        videoId: f.videoId,
        title: f.title.trim(),
        ref: f.ref.trim(),
        preacher: '',
        date: f.date,
        category: f.category as ThemeKey,
        tags: [...f.tags],
        short: f.short.trim(),
        long,
        transcript: f.transcript.trim(),
        featured: false,
      };
      setSermons((list) => [created, ...list]);
      publish(
        `“${f.title.trim()}” is publishing — it’ll appear on the site in a minute or two.`,
      );
      setView('library');
      toastMsg('Sermon added');
    } else {
      setSermons((list) =>
        list.map((s) =>
          s.id === f.id
            ? {
                ...s,
                slug,
                videoId: f.videoId,
                title: f.title.trim(),
                ref: f.ref.trim(),
                date: f.date,
                category: f.category as ThemeKey,
                tags: [...f.tags],
                short: f.short.trim(),
                long,
                transcript: f.transcript.trim(),
              }
            : s,
        ),
      );
      publish(
        `Your changes to “${f.title.trim()}” are publishing — live on the site in a minute or two.`,
      );
      setView('library');
      toastMsg('Changes saved');
    }
  };

  const trySave = () => {
    if (!form) return;
    const e = validate(form);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    const slug = slugify(form.slug || form.title);
    const slugChanged =
      formMode === 'edit' && !!origSlug && slug !== origSlug;
    if (slugChanged) {
      openModal({
        kind: 'warn',
        title: 'Change the web address?',
        body: 'This sermon is already public at its current address. Changing it breaks any links people have already shared — the old link will lead nowhere.',
        confirm: 'Change address & save',
        onConfirm: () => {
          closeModal();
          commitSave();
        },
      });
      return;
    }
    commitSave();
  };

  // -------------------------------------------------------------------------
  // Feature / delete
  // -------------------------------------------------------------------------
  const askFeature = (id: string) => {
    const s = sermons.find((x) => x.id === id);
    if (!s || s.featured) return;
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
      onConfirm: () => {
        setSermons((list) => list.map((x) => ({ ...x, featured: x.id === id })));
        closeModal();
        publish(
          `“${s.title}” is now the featured sermon — updating on the site shortly.`,
        );
        toastMsg('Featured sermon updated');
      },
    });
  };

  const askDelete = (id: string) => {
    const s = sermons.find((x) => x.id === id);
    if (!s) return;
    const others = sermons.filter((x) => x.id !== id);
    let body = `Removing “${s.title}” takes it off the public site immediately. Anyone who saved or shared its link will no longer find it. This can’t be undone.`;
    if (s.featured && others.length)
      body +=
        ' Because it’s the featured sermon, the most recent remaining sermon will become featured in its place.';
    openModal({
      kind: 'danger',
      title: 'Remove this sermon?',
      body,
      confirm: 'Remove sermon',
      onConfirm: () => {
        setSermons((list) => {
          const wasFeatured = s.featured;
          let next = list.filter((x) => x.id !== id);
          if (wasFeatured && next.length) {
            const top = [...next].sort(
              (a, b) => +new Date(b.date) - +new Date(a.date),
            )[0];
            next = next.map((x) => ({ ...x, featured: x.id === top.id }));
          }
          return next;
        });
        closeModal();
        publish(`“${s.title}” is being removed from the site.`);
        toastMsg('Sermon removed');
      },
    });
  };

  // -------------------------------------------------------------------------
  // Tags
  // -------------------------------------------------------------------------
  const tagUsage = (t: string) =>
    sermons.filter((s) => s.tags.includes(t)).length;

  const addTag = () => {
    const n = newTag.trim();
    if (!n) return;
    if (tags.some((t) => t.toLowerCase() === n.toLowerCase())) {
      setTagErr(`“${n}” already exists.`);
      return;
    }
    setTags((list) => [...list, n].sort((a, b) => a.localeCompare(b)));
    setNewTag('');
    setTagErr('');
    toastMsg('Tag added');
  };

  const startTagEdit = (t: string) => {
    setTagEdit(t);
    setTagEditVal(t);
    setTagErr('');
  };
  const cancelTagEdit = () => {
    setTagEdit(null);
    setTagEditVal('');
  };
  const saveTagEdit = () => {
    const orig = tagEdit;
    if (!orig) return;
    const nn = tagEditVal.trim();
    if (!nn) {
      setTagEdit(null);
      return;
    }
    if (nn !== orig && tags.some((t) => t.toLowerCase() === nn.toLowerCase())) {
      setTagErr(`“${nn}” already exists.`);
      return;
    }
    setTags((list) =>
      list.map((t) => (t === orig ? nn : t)).sort((a, b) => a.localeCompare(b)),
    );
    setSermons((list) =>
      list.map((s) => ({
        ...s,
        tags: s.tags.map((t) => (t === orig ? nn : t)),
      })),
    );
    setTagEdit(null);
    setTagEditVal('');
    setTagErr('');
    toastMsg('Tag renamed');
  };

  const askRetireTag = (t: string) => {
    const n = tagUsage(t);
    if (n > 0) {
      openModal({
        kind: 'info',
        single: true,
        title: 'This tag is still in use',
        body: `“${t}” is attached to ${n} sermon${
          n === 1 ? '' : 's'
        }. Remove it from those sermons first, then you can retire the tag.`,
        confirm: 'Got it',
      });
      return;
    }
    openModal({
      kind: 'danger',
      title: 'Retire this tag?',
      body: `“${t}” isn’t attached to any sermon. Retiring removes it from the list operators choose from.`,
      confirm: 'Retire tag',
      onConfirm: () => {
        setTags((list) => list.filter((x) => x !== t));
        closeModal();
        toastMsg('Tag retired');
      },
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
      `${s.title} ${s.ref} ${s.short} ${s.tags.join(' ')} ${themeName(
        s.category,
      )}`
        .toLowerCase()
        .includes(q),
    );
  list.sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const rows: LibraryRow[] = list.map((s) => ({
    id: s.id,
    title: s.title,
    ref: s.ref,
    formattedDate: formatAdminDate(s.date),
    catName: themeName(s.category),
    thumb: thumbUrl(s.videoId),
    short: s.short,
    featured: !!s.featured,
    tagsShown: s.tags.slice(0, 3),
    tagsMore: s.tags.length > 3 ? `+${s.tags.length - 3} more` : '',
    hasMore: s.tags.length > 3,
    onEdit: () => startEdit(s.id),
    onDelete: () => askDelete(s.id),
    onFeature: () => askFeature(s.id),
  }));

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
    emptySub = `No sermons have been added under ${themeName(
      themeFilter,
    )} so far.`;
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

  const tagOptions: TagOption[] = [...tags]
    .sort((a, b) => a.localeCompare(b))
    .map((t) => ({
      name: t,
      selected: !!form && form.tags.includes(t),
      onToggle: () => toggleFormTag(t),
    }));

  const tagRows: TagRow[] = [...tags]
    .sort((a, b) => a.localeCompare(b))
    .map((t) => {
      const n = tagUsage(t);
      return {
        name: t,
        usageLabel: n === 0 ? 'Not in use' : `${n} sermon${n === 1 ? '' : 's'}`,
        editing: tagEdit === t,
        onEdit: () => startTagEdit(t),
        onRetire: () => askRetireTag(t),
      };
    });

  const initials = (email || 'O').trim().charAt(0).toUpperCase();

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (!authed) {
    return (
      <div className={styles.root}>
        <SignIn
          email={email}
          pass={pass}
          error={signinErr}
          onEmail={setEmail}
          onPass={setPass}
          onSubmit={signIn}
        />
      </div>
    );
  }

  const isDanger = modal?.kind === 'danger';

  return (
    <div className={styles.root}>
      <div className={styles.shell}>
        <Sidebar
          view={view}
          email={email}
          initials={initials}
          onGoLibrary={goLibrary}
          onGoTags={goTags}
          onStartAdd={startAdd}
          onSignOut={signOut}
        />

        <main className={styles.main}>
          {publishing && (
            <div className={styles.banner}>
              <span key={pubSeq} className={styles.bannerBar} />
              <span className={styles.bannerDot} />
              <span className={styles.bannerText}>{publishing}</span>
              <button
                type="button"
                className={styles.bannerDismiss}
                onClick={() => setPublishing(null)}
              >
                Dismiss
              </button>
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
                onClick={() => {
                  if (modal.onConfirm) modal.onConfirm();
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

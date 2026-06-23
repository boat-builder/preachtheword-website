import Image from 'next/image';
import type { FormState, FormErrors } from './types';
import { CheckIcon, WarnIcon } from './icons';
import styles from './admin.module.css';

export interface ThemeOption {
  key: string;
  name: string;
  selected: boolean;
  onSelect: () => void;
}

export interface TagOption {
  id: string;
  name: string;
  selected: boolean;
  onToggle: () => void;
}

interface SermonFormProps {
  form: FormState;
  errors: FormErrors;
  isEdit: boolean;
  heading: string;
  saveLabel: string;
  fetchKind: '' | 'ok' | 'err';
  fetchMsg: string;
  /** Disable the save button + show progress while a server action runs. */
  busy?: boolean;
  themeOptions: ThemeOption[];
  tagOptions: TagOption[];
  selectedCount: number;
  onField: (key: keyof FormState, value: string) => void;
  onFetch: () => void;
  onSave: () => void;
  onCancel: () => void;
  onGoTags: () => void;
}

export default function SermonForm({
  form,
  errors,
  isEdit,
  heading,
  saveLabel,
  fetchKind,
  fetchMsg,
  busy = false,
  themeOptions,
  tagOptions,
  selectedCount,
  onField,
  onFetch,
  onSave,
  onCancel,
  onGoTags,
}: SermonFormProps) {
  return (
    <div className={`${styles.formWrap} ${styles.viewIn}`}>
      <button type="button" className={styles.backBtn} onClick={onCancel}>
        ← Back to library
      </button>
      <h1 className={styles.formTitle}>{heading}</h1>
      <p className={styles.formIntro}>
        Saving publishes straight to the live site — there are no private drafts.
        Changes appear after a minute or two.
      </p>

      {/* 1. VIDEO */}
      <section className={styles.card}>
        <div className={`${styles.cardHead} ${styles.cardHeadTight}`}>
          <span className={styles.stepNum}>1</span>
          <h2 className={styles.cardTitle}>The video</h2>
        </div>
        <p className={styles.cardDesc}>
          Paste the sermon&rsquo;s video link. We&rsquo;ll pull in the title and
          preview image automatically — the preview image always comes from the
          video.
        </p>
        <label className={styles.label}>
          Video link <span className={styles.req}>*</span>
        </label>
        <div className={styles.videoRow}>
          <input
            value={form.videoUrl}
            onChange={(e) => onField('videoUrl', e.target.value)}
            placeholder="https://youtu.be/…"
            className={`${styles.field} ${styles.videoInput}`}
          />
          <button type="button" className={styles.btnDark} onClick={onFetch}>
            Fetch details
          </button>
        </div>
        {errors.video && <div className={styles.errText}>{errors.video}</div>}
        {fetchKind === 'err' && <div className={styles.errText}>{fetchMsg}</div>}
        {form.thumb && (
          <div className={styles.fetchPreview}>
            <Image
              src={form.thumb}
              alt=""
              width={128}
              height={72}
              className={styles.fetchThumb}
              unoptimized
            />
            <div style={{ minWidth: 0 }}>
              {fetchKind === 'ok' && (
                <div className={styles.fetchOk}>
                  <CheckIcon size={14} stroke="currentColor" />
                  {fetchMsg}
                </div>
              )}
              <div className={styles.fetchNote}>
                This preview image will be used everywhere the sermon appears.
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2. DETAILS */}
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.stepNum}>2</span>
          <h2 className={styles.cardTitle}>Title &amp; details</h2>
        </div>
        <label className={styles.label}>
          Title <span className={styles.req}>*</span>
        </label>
        <input
          value={form.title}
          onChange={(e) => onField('title', e.target.value)}
          placeholder="e.g. Finishing Well"
          className={styles.field}
        />
        {errors.title && <div className={styles.errText}>{errors.title}</div>}
        <div className={styles.grid2}>
          <div>
            <label className={styles.label}>
              Scripture reference <span className={styles.req}>*</span>
            </label>
            <input
              value={form.ref}
              onChange={(e) => onField('ref', e.target.value)}
              placeholder="e.g. 2 Timothy 2:8"
              className={styles.field}
            />
            {errors.ref && <div className={styles.errText}>{errors.ref}</div>}
          </div>
          <div>
            <label className={styles.label}>
              Date <span className={styles.req}>*</span>
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => onField('date', e.target.value)}
              className={styles.field}
            />
            {errors.date && <div className={styles.errText}>{errors.date}</div>}
          </div>
        </div>
      </section>

      {/* 3. THEME */}
      <section className={styles.card}>
        <div className={`${styles.cardHead} ${styles.cardHeadTight}`}>
          <span className={styles.stepNum}>3</span>
          <h2 className={styles.cardTitle}>
            Theme <span className={styles.req}>*</span>
          </h2>
        </div>
        <p className={styles.cardDesc}>
          Every sermon belongs to exactly one of the five themes.
        </p>
        <div className={styles.themeGrid}>
          {themeOptions.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={t.onSelect}
              className={`${styles.themeOpt}${
                t.selected ? ` ${styles.themeOptSel}` : ''
              }`}
            >
              <span className={styles.radio}>
                {t.selected && <span className={styles.radioDot} />}
              </span>
              {t.name}
            </button>
          ))}
        </div>
        {errors.category && (
          <div className={styles.errText} style={{ marginTop: 10 }}>
            {errors.category}
          </div>
        )}
      </section>

      {/* 4. SUMMARIES */}
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.stepNum}>4</span>
          <h2 className={styles.cardTitle}>The message</h2>
        </div>
        <label className={styles.label}>
          Short summary <span className={styles.req}>*</span>{' '}
          <span className={styles.labelHint}>
            — a sentence or two, shown as the preview
          </span>
        </label>
        <textarea
          value={form.short}
          onChange={(e) => onField('short', e.target.value)}
          rows={3}
          placeholder="A concise preview of the message…"
          className={styles.field}
        />
        {errors.short && <div className={styles.errText}>{errors.short}</div>}
        <label className={styles.label} style={{ marginTop: 16 }}>
          Full message <span className={styles.req}>*</span>{' '}
          <span className={styles.labelHint}>
            — separate paragraphs with a blank line
          </span>
        </label>
        <textarea
          value={form.longText}
          onChange={(e) => onField('longText', e.target.value)}
          rows={7}
          placeholder="Write the full message here. Leave a blank line between paragraphs."
          className={styles.field}
        />
        {errors.long && <div className={styles.errText}>{errors.long}</div>}
      </section>

      {/* 5. TAGS */}
      <section className={styles.card}>
        <div className={`${styles.cardHead} ${styles.cardHeadTight}`}>
          <span className={styles.stepNum}>5</span>
          <h2 className={styles.cardTitle}>Topic tags</h2>
          <span className={styles.selectedCount}>{selectedCount} selected</span>
        </div>
        <p className={styles.cardDesc}>
          Choose from the maintained list. To add a new tag, use{' '}
          <button type="button" className={styles.inlineLink} onClick={onGoTags}>
            Topic tags
          </button>
          .
        </p>
        <div className={styles.tagPicker}>
          {tagOptions.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={t.onToggle}
              className={`${styles.tagOpt}${
                t.selected ? ` ${styles.tagOptSel}` : ''
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </section>

      {/* 6. WEB ADDRESS */}
      <section className={styles.card}>
        <div className={`${styles.cardHead} ${styles.cardHeadTight}`}>
          <span className={styles.stepNum}>6</span>
          <h2 className={styles.cardTitle}>Web address</h2>
        </div>
        <p className={styles.cardDesc}>
          Suggested from the title. You can adjust it.
        </p>
        <div className={styles.slugRow}>
          <span className={styles.slugPrefix}>preachtheword.faith/sermons/</span>
          <input
            value={form.slug}
            onChange={(e) => onField('slug', e.target.value)}
            placeholder="finishing-well"
            className={styles.slugInput}
          />
        </div>
        {errors.slug && <div className={styles.errText}>{errors.slug}</div>}
        {isEdit && (
          <div className={styles.warnBox}>
            <WarnIcon className={styles.warnBoxIcon} />
            <div className={styles.warnBoxText}>
              This sermon is already public. Changing its address breaks links
              people have already shared — we&rsquo;ll ask you to confirm before
              saving.
            </div>
          </div>
        )}
      </section>

      {/* 7. TRANSCRIPT */}
      <section className={styles.card}>
        <div className={`${styles.cardHead} ${styles.cardHeadTight}`}>
          <span className={`${styles.stepNum} ${styles.stepNumMuted}`}>7</span>
          <h2 className={styles.cardTitle}>Transcript</h2>
          <span className={styles.optionalPill}>Optional</span>
        </div>
        <p className={styles.cardDesc}>
          The full transcript of the talk, if you have it.
        </p>
        <textarea
          value={form.transcript}
          onChange={(e) => onField('transcript', e.target.value)}
          rows={5}
          placeholder="Paste the full transcript here (optional)…"
          className={styles.field}
        />
      </section>

      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={onSave}
          disabled={busy}
        >
          {busy ? 'Saving…' : saveLabel}
        </button>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <span className={styles.formActionsNote}>
          Saving publishes to the live site.
        </span>
      </div>
    </div>
  );
}

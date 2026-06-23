import styles from './admin.module.css';

export interface TagRow {
  id: string;
  name: string;
  usageLabel: string;
  retired: boolean;
  /** Hard delete is only offered for tags no sermon uses. */
  canDelete: boolean;
  editing: boolean;
  onEdit: () => void;
  onRetire: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

interface TagsViewProps {
  tagRows: TagRow[];
  newTag: string;
  tagErr: string;
  tagEditVal: string;
  onNewTag: (value: string) => void;
  onAddTag: () => void;
  onTagEditVal: (value: string) => void;
  onSaveTagEdit: () => void;
  onCancelTagEdit: () => void;
}

export default function TagsView({
  tagRows,
  newTag,
  tagErr,
  tagEditVal,
  onNewTag,
  onAddTag,
  onTagEditVal,
  onSaveTagEdit,
  onCancelTagEdit,
}: TagsViewProps) {
  return (
    <div className={`${styles.tagsWrap} ${styles.viewIn}`}>
      <h1 className={styles.pageTitle}>Topic tags</h1>
      <p className={styles.tagsIntro}>
        The list operators choose from when tagging a sermon — and the
        &ldquo;Looking for a word on…&rdquo; chips on the home page. Retiring a tag
        hides it from those lists but keeps it on sermons already using it; a tag no
        sermon uses can be deleted outright.
      </p>

      <div className={styles.addTagCard}>
        <label className={styles.label} htmlFor="admin-new-tag">
          Add a new tag
        </label>
        <div className={styles.addTagRow}>
          <input
            id="admin-new-tag"
            value={newTag}
            onChange={(e) => onNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddTag();
              }
            }}
            placeholder="e.g. Prayer"
            className={styles.field}
          />
          <button type="button" className={styles.addTagBtn} onClick={onAddTag}>
            Add tag
          </button>
        </div>
        {tagErr && <div className={styles.errText}>{tagErr}</div>}
      </div>

      <div className={styles.tagList}>
        {tagRows.map((t) => (
          <div key={t.id} className={styles.tagRow}>
            {t.editing ? (
              <>
                <input
                  value={tagEditVal}
                  onChange={(e) => onTagEditVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onSaveTagEdit();
                    } else if (e.key === 'Escape') {
                      onCancelTagEdit();
                    }
                  }}
                  className={styles.tagEditInput}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.tagEditSave}
                  onClick={onSaveTagEdit}
                >
                  Save
                </button>
                <button
                  type="button"
                  className={styles.tagEditCancel}
                  onClick={onCancelTagEdit}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className={styles.tagName}>
                  {t.name}
                  {t.retired && (
                    <span className={styles.optionalPill} style={{ marginLeft: 8 }}>
                      Retired
                    </span>
                  )}
                </span>
                <span className={styles.tagUsage}>{t.usageLabel}</span>
                <button
                  type="button"
                  className={styles.tagRename}
                  onClick={t.onEdit}
                >
                  Rename
                </button>
                {t.retired ? (
                  <button
                    type="button"
                    className={styles.tagRename}
                    onClick={t.onRestore}
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.tagRetire}
                    onClick={t.onRetire}
                  >
                    Retire
                  </button>
                )}
                {t.canDelete && (
                  <button
                    type="button"
                    className={styles.tagRetire}
                    onClick={t.onDelete}
                  >
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

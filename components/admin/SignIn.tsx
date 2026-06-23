import styles from './admin.module.css';

interface SignInProps {
  email: string;
  pass: string;
  error: string;
  onEmail: (value: string) => void;
  onPass: (value: string) => void;
  onSubmit: () => void;
}

export default function SignIn({
  email,
  pass,
  error,
  onEmail,
  onPass,
  onSubmit,
}: SignInProps) {
  return (
    <div className={styles.signinScreen}>
      <div className={styles.signinCard}>
        <div className={styles.signinBrand}>
          <div className={styles.signinMark}>
            <span className={styles.markRing} />
          </div>
          <div className={styles.signinBrandText}>
            <div className={styles.signinBrandName}>Preach the Word</div>
            <div className={styles.signinBrandSub}>Content admin</div>
          </div>
        </div>

        <form
          className={styles.signinPanel}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <h1 className={styles.signinTitle}>Sign in</h1>
          <p className={styles.signinSub}>
            Restricted to authorized content operators.
          </p>

          <label className={styles.label} htmlFor="admin-email">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder="you@preachtheword.faith"
            className={`${styles.field} ${styles.gap16}`}
            autoComplete="email"
          />

          <label className={styles.label} htmlFor="admin-pass">
            Password
          </label>
          <input
            id="admin-pass"
            type="password"
            value={pass}
            onChange={(e) => onPass(e.target.value)}
            placeholder="••••••••"
            className={styles.field}
            autoComplete="current-password"
          />

          {error && <div className={styles.signinErr}>{error}</div>}

          <button
            type="submit"
            className={`${styles.btnPrimary} ${styles.signinBtn}`}
          >
            Sign in
          </button>
        </form>

        <p className={styles.signinFoot}>Preach the Word · internal tool</p>
      </div>
    </div>
  );
}

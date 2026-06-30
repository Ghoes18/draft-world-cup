"use client";

import { useSignInForm } from "../_hooks/useAuth";
import { useStrings } from "../_i18n/LocaleProvider";

type Variant = "full" | "compact";

function GoogleMark() {
  return (
    <svg className="auth-google-btn__icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/** Google, magic link, and email/password sign-in. */
export function SignInPanel({ variant = "full" }: { variant?: Variant }) {
  const S = useStrings();
  const {
    auth,
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    mode,
    setMode,
    isSignUp,
    setIsSignUp,
    pending,
    message,
    error,
    setError,
    setMessage,
    submitMagicLink,
    submitPassword,
  } = useSignInForm();

  const compact = variant === "compact";

  return (
    <article
      className={["auth-pass", compact ? "auth-pass--compact" : ""].filter(Boolean).join(" ")}
      aria-label={S.auth.signInTitle}
    >
      <span className="auth-pass__chalk auth-pass__chalk--tl" aria-hidden />
      <span className="auth-pass__chalk auth-pass__chalk--tr" aria-hidden />
      <span className="auth-pass__chalk auth-pass__chalk--bl" aria-hidden />
      <span className="auth-pass__chalk auth-pass__chalk--br" aria-hidden />

      <header className="auth-pass__head">
        {!compact ? (
          <>
            <p className="auth-pass__tag mono">{S.auth.kicker}</p>
            <h2 className="auth-pass__title">{S.auth.signInTitle}</h2>
            <p className="auth-pass__lead dim">{S.auth.signInBody}</p>
          </>
        ) : (
          <h2 className="auth-pass__title auth-pass__title--compact">{S.auth.signIn}</h2>
        )}
      </header>

      <div className="auth-pass__body">
        <button
          type="button"
          className="auth-google-btn"
          disabled={pending}
          onClick={() => void auth.signInGoogle()}
        >
          <GoogleMark />
          <span>{S.auth.signInGoogle}</span>
        </button>

        <p className="auth-divider mono dim" role="presentation">
          <span>{S.auth.orDivider}</span>
        </p>

        <div className="auth-segment" role="tablist" aria-label={S.auth.methodTabs}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "magic"}
            className={[
              "auth-segment__btn",
              mode === "magic" ? "auth-segment__btn--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              setMode("magic");
              setError(null);
              setMessage(null);
            }}
          >
            {S.auth.magicLinkTab}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "password"}
            className={[
              "auth-segment__btn",
              mode === "password" ? "auth-segment__btn--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              setMode("password");
              setError(null);
              setMessage(null);
            }}
          >
            {S.auth.emailPasswordTab}
          </button>
        </div>

        {mode === "magic" ? (
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submitMagicLink();
            }}
          >
            <label className="auth-field">
              <span className="auth-field__label mono">{S.auth.emailLabel}</span>
              <input
                className="auth-field__input"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={S.auth.emailPlaceholder}
              />
            </label>
            <button
              type="submit"
              className="btn-kick auth-form__submit"
              disabled={pending || !email.trim()}
            >
              {pending ? S.auth.sending : S.auth.sendMagicLink}
            </button>
            {message === "sent" && (
              <p className="auth-form__success" role="status">
                <span className="auth-form__success-mark" aria-hidden>
                  ✓
                </span>
                {S.auth.magicLinkSent(email)}
              </p>
            )}
          </form>
        ) : (
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submitPassword();
            }}
          >
            {isSignUp && (
              <label className="auth-field">
                <span className="auth-field__label mono">{S.auth.nameLabel}</span>
                <input
                  className="auth-field__input"
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={S.auth.namePlaceholder}
                />
              </label>
            )}
            <label className="auth-field">
              <span className="auth-field__label mono">{S.auth.emailLabel}</span>
              <input
                className="auth-field__input"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={S.auth.emailPlaceholder}
              />
            </label>
            <label className="auth-field">
              <span className="auth-field__label mono">{S.auth.passwordLabel}</span>
              <input
                className="auth-field__input"
                type="password"
                name="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={S.auth.passwordPlaceholder}
              />
            </label>
            <button
              type="submit"
              className="btn-kick auth-form__submit"
              disabled={pending || !email.trim() || password.length < 8}
            >
              {pending ? S.auth.working : isSignUp ? S.auth.signUp : S.auth.signInWithEmail}
            </button>
            <button
              type="button"
              className="auth-form__toggle mono"
              onClick={() => {
                setIsSignUp((v) => !v);
                setError(null);
              }}
            >
              {isSignUp ? S.auth.haveAccount : S.auth.needAccount}
            </button>
          </form>
        )}

        {error && (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}

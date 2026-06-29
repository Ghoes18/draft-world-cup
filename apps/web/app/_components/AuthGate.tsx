"use client";

import { useAuth } from "../_hooks/useAuth";
import { useStrings } from "../_i18n/LocaleProvider";

/** Sign-in prompt for routes that require authentication (mode C). */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const S = useStrings();
  const { isAuthenticated, isLoading, signInGoogle } = useAuth();

  if (isLoading) {
    return <p className="dim">{S.auth.loading}</p>;
  }

  if (!isAuthenticated) {
    return (
      <section className="panel auth-gate" style={{ padding: "1.5rem" }}>
        <p className="panel__kicker mono dim">{S.auth.kicker}</p>
        <h2 className="panel__title">{S.auth.signInTitle}</h2>
        <p className="dim">{S.auth.signInBody}</p>
        <div className="auth-gate__actions">
          <button type="button" className="btn-kick" onClick={() => void signInGoogle()}>
            {S.auth.signInGoogle}
          </button>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}

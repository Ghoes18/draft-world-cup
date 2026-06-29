"use client";

import { useAuth } from "../_hooks/useAuth";
import { useStrings } from "../_i18n/LocaleProvider";

export function AuthControls() {
  const S = useStrings();
  const { isAuthenticated, isLoading, name, signInGoogle, signOut } = useAuth();

  if (process.env.NEXT_PUBLIC_CONVEX_URL == null) return null;

  if (isLoading) {
    return <span className="topbar__auth mono dim">{S.auth.loading}</span>;
  }

  if (!isAuthenticated) {
    return (
      <button type="button" className="btn-ghost topbar__auth-btn" onClick={() => void signInGoogle()}>
        {S.auth.signIn}
      </button>
    );
  }

  return (
    <div className="topbar__auth">
      <span className="topbar__auth-name mono" title={name}>
        {name}
      </span>
      <button type="button" className="btn-ghost topbar__auth-btn" onClick={() => void signOut()}>
        {S.auth.signOut}
      </button>
    </div>
  );
}

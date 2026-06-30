"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../_hooks/useAuth";
import { useStrings } from "../_i18n/LocaleProvider";
import { SignInPanel } from "./SignInPanel";

export function AuthControls() {
  const S = useStrings();
  const { isAuthenticated, isLoading, name, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (process.env.NEXT_PUBLIC_CONVEX_URL == null) return null;

  if (isLoading) {
    return <span className="topbar__auth mono dim">{S.auth.loading}</span>;
  }

  if (!isAuthenticated) {
    return (
      <div className="topbar__auth-wrap" ref={wrapRef}>
        <button
          type="button"
          className="btn-ghost topbar__auth-btn"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
        >
          {S.auth.signIn}
        </button>
        {open && (
          <div className="auth-popover" role="dialog" aria-label={S.auth.signInTitle}>
            <SignInPanel variant="compact" />
          </div>
        )}
      </div>
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

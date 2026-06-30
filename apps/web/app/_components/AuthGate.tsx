"use client";

import { useAuth } from "../_hooks/useAuth";
import { useStrings } from "../_i18n/LocaleProvider";
import { SignInPanel } from "./SignInPanel";

/** Sign-in prompt for routes that require authentication (mode C). */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const S = useStrings();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="auth-gate auth-gate--loading">
        <p className="auth-gate__status mono dim">{S.auth.loading}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-gate">
        <SignInPanel variant="full" />
      </div>
    );
  }

  return <>{children}</>;
}

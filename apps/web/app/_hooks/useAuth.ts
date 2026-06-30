"use client";

import { useCallback, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { authClient } from "../_lib/auth-client";

function callbackUrl(): string {
  return typeof window !== "undefined" ? window.location.href : "/";
}

export function useAuth(): {
  user: { id: string; name: string; email: string; image?: string | null } | null | undefined;
  playerId: string | null;
  name: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInGoogle: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<{ ok: boolean; error?: string }>;
  signInEmail: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUpEmail: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
} {
  const user = useQuery(
    api.auth.getCurrentUser,
    process.env.NEXT_PUBLIC_CONVEX_URL != null ? {} : "skip",
  );

  const signInGoogle = useCallback(async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: callbackUrl(),
    });
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    try {
      const { error } = await authClient.signIn.magicLink({
        email: email.trim(),
        callbackURL: callbackUrl(),
      });
      if (error) return { ok: false, error: error.message ?? "Failed to send link" };
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Failed to send link",
      };
    }
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await authClient.signIn.email({
        email: email.trim(),
        password,
        callbackURL: callbackUrl(),
      });
      if (error) return { ok: false, error: error.message ?? "Sign in failed" };
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Sign in failed",
      };
    }
  }, []);

  const signUpEmail = useCallback(
    async (email: string, password: string, displayName: string) => {
      try {
        const { error } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: displayName.trim() || email.split("@")[0] || "Coach",
          callbackURL: callbackUrl(),
        });
        if (error) return { ok: false, error: error.message ?? "Sign up failed" };
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Sign up failed",
        };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    await authClient.signOut();
  }, []);

  const isLoading = user === undefined;
  const isAuthenticated = user != null;

  return {
    user,
    playerId: user?.id ?? null,
    name: user?.name ?? "",
    isAuthenticated,
    isLoading,
    signInGoogle,
    sendMagicLink,
    signInEmail,
    signUpEmail,
    signOut,
  };
}

/** Hook for sign-in form state shared by AuthGate / AuthControls. */
export function useSignInForm() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [isSignUp, setIsSignUp] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitMagicLink() {
    setPending(true);
    setError(null);
    setMessage(null);
    const res = await auth.sendMagicLink(email);
    setPending(false);
    if (res.ok) setMessage("sent");
    else setError(res.error ?? "Failed");
  }

  async function submitPassword() {
    setPending(true);
    setError(null);
    setMessage(null);
    const res = isSignUp
      ? await auth.signUpEmail(email, password, displayName)
      : await auth.signInEmail(email, password);
    setPending(false);
    if (!res.ok) setError(res.error ?? "Failed");
  }

  return {
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
  };
}

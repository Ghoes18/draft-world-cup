"use client";

import { useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { authClient } from "../_lib/auth-client";

export function useAuth(): {
  user: { id: string; name: string; email: string; image?: string | null } | null | undefined;
  playerId: string | null;
  name: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
} {
  const user = useQuery(
    api.auth.getCurrentUser,
    process.env.NEXT_PUBLIC_CONVEX_URL != null ? {} : "skip",
  );

  const signInGoogle = useCallback(async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: typeof window !== "undefined" ? window.location.href : "/",
    });
  }, []);

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
    signOut,
  };
}

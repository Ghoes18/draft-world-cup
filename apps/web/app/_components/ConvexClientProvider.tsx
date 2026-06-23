"use client";

import { ReactNode, useMemo } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

/**
 * Wraps the app in a Convex client for the online duel (M4). The deployment URL
 * is written to `.env.local` as NEXT_PUBLIC_CONVEX_URL by `npx convex dev`.
 * When it is absent (e.g. solo-only local run), we render children unwrapped so
 * the rest of the app still works; the /duel route shows a setup hint instead.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    return url ? new ConvexReactClient(url) : null;
  }, []);

  if (!client) return <>{children}</>;
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}

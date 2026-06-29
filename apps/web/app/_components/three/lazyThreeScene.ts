import dynamic from "next/dynamic";
import type { ComponentType } from "react";

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "ChunkLoadError" ||
    error.message.includes("Loading chunk") ||
    error.message.includes("Failed to fetch dynamically imported module")
  );
}

/**
 * Lazy-load a decorative Three.js scene with retry + silent fallback.
 * ChunkLoadError usually means a stale dev bundle or deploy mismatch — retry
 * once, then skip the GPU layer so the app stays usable.
 */
export function lazyThreeScene<P extends Record<string, never> = Record<string, never>>(
  factory: () => Promise<{ default: ComponentType<P> }>,
) {
  return dynamic(
    async () => {
      try {
        return await factory();
      } catch (firstError) {
        if (!isChunkLoadError(firstError)) throw firstError;
        await new Promise((resolve) => setTimeout(resolve, 150));
        try {
          return await factory();
        } catch (retryError) {
          console.warn("3D scene chunk failed to load; skipping decorative layer.", retryError);
          const Empty = () => null;
          return { default: Empty as ComponentType<P> };
        }
      }
    },
    { ssr: false, loading: () => null },
  );
}

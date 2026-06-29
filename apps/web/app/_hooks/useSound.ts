"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isMuted,
  playCue,
  setMuted,
  type SoundCue,
} from "../_lib/soundscape";

const STORAGE_KEY = "ninety:sound";

/** Read the saved mute preference (default: unmuted). SSR-safe. */
function readMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "muted";
  } catch {
    return false;
  }
}

/**
 * Procedural-sound control. `play(cue)` is a no-op while muted; the mute flag is
 * shared across the app (via the soundscape module) and persisted to
 * localStorage so it survives reloads.
 */
export function useSound(): {
  play: (cue: SoundCue) => void;
  muted: boolean;
  toggleMute: () => void;
} {
  const [muted, setLocalMuted] = useState(false);

  // Hydrate from storage on mount (avoids SSR/client mismatch).
  useEffect(() => {
    const saved = readMuted();
    setMuted(saved);
    setLocalMuted(saved);
  }, []);

  const play = useCallback((cue: SoundCue) => {
    if (isMuted()) return;
    playCue(cue);
  }, []);

  const toggleMute = useCallback(() => {
    // Flip the shared module flag synchronously so a follow-up play() in the
    // same handler sees the new state immediately.
    const next = !isMuted();
    setMuted(next);
    setLocalMuted(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "muted" : "on");
    } catch {
      /* ignore storage failures */
    }
  }, []);

  return { play, muted, toggleMute };
}

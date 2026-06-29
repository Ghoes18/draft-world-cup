"use client";

import { useStrings } from "../_i18n/LocaleProvider";
import { useSound } from "../_hooks/useSound";

function SoundIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M11 5L6 9H3v6h3l5 4V5z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M16 9l4 4M20 9l-4 4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 5L6 9H3v6h3l5 4V5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 8.5a4.5 4.5 0 010 7M18 6a8 8 0 010 12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Speaker button that mutes/unmutes the procedural soundscape. */
export function SoundToggle() {
  const S = useStrings();
  const { muted, toggleMute, play } = useSound();

  return (
    <button
      type="button"
      className="sound-toggle pressable"
      aria-pressed={!muted}
      aria-label={muted ? S.sound.unmute : S.sound.mute}
      title={muted ? S.sound.unmute : S.sound.mute}
      onClick={() => {
        const wasMuted = muted;
        toggleMute();
        if (wasMuted) play("pick");
      }}
    >
      <SoundIcon muted={muted} />
    </button>
  );
}

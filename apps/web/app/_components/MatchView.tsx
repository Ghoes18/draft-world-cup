"use client";

/**
 * MatchView — text-only match presentation (no 2D), like the original 7a0.
 *
 * Two modes, both reading the same MatchTimeline via the engine's `toFastText`
 * consumer:
 *  - "ultra": the full result printed instantly (original 7a0 behaviour).
 *  - "fast":  a minute-by-minute ticker that reveals events over time
 *             (also the screen-reader-friendly path, MVP §4.1 / RF-S3).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toFastText, type MatchTimeline } from "7a0-engine";
import { STRINGS as S } from "../_data/strings";

type Mode = "fast" | "ultra";

const MODE_KEY = "7a0-mode";
const TICK_MS = 450; // one ticker line every ~0.45s

function loadMode(): Mode {
  if (typeof localStorage === "undefined") return "fast";
  return localStorage.getItem(MODE_KEY) === "ultra" ? "ultra" : "fast";
}

export function MatchView({
  timeline,
  labels,
}: {
  timeline: MatchTimeline;
  labels?: { home: string; away: string };
}) {
  const lines = useMemo(
    () => toFastText(timeline, labels ? { labels } : undefined),
    [timeline, labels],
  );

  const [mode, setMode] = useState<Mode>("fast");
  const [revealed, setRevealed] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
  }, []);

  // Sync persisted mode on mount (client-only, avoids hydration mismatch).
  useEffect(() => {
    setMode(loadMode());
  }, []);

  // Drive the ticker / set instant content whenever the match or mode changes.
  useEffect(() => {
    stop();
    if (mode === "ultra") {
      setRevealed(lines.length);
    } else {
      setRevealed(0);
      setRunning(true);
    }
    return stop;
  }, [lines, mode, stop]);

  // The ticker interval.
  useEffect(() => {
    if (mode !== "fast" || !running) return;
    timerRef.current = setInterval(() => {
      setRevealed((n) => {
        if (n >= lines.length) {
          stop();
          return n;
        }
        return n + 1;
      });
    }, TICK_MS);
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [mode, running, lines.length, stop]);

  function changeMode(next: Mode) {
    setMode(next);
    if (typeof localStorage !== "undefined") localStorage.setItem(MODE_KEY, next);
  }

  function togglePlay() {
    if (running) {
      stop();
    } else {
      if (revealed >= lines.length) setRevealed(0);
      setRunning(true);
    }
  }

  function restart() {
    stop();
    setRevealed(0);
    setRunning(true);
  }

  function skip() {
    stop();
    setRevealed(lines.length);
  }

  const atEnd = revealed >= lines.length;
  const shown = lines.slice(0, revealed);
  const live = mode === "fast" && running && !atEnd;

  return (
    <section className="panel">
      <div className="feed__bar">
        <div>
          <div className="eyebrow">{S.matchKicker}</div>
          <h2 className="panel__title">{S.matchTitle}</h2>
        </div>
        <div className="row" style={{ gap: "0.5rem" }}>
          <span className="status">
            <span
              className="status__dot"
              data-live={live ? "true" : "false"}
              aria-hidden
            />
            {live ? S.live : S.full}
          </span>
          {(["fast", "ultra"] as const).map((m) => (
            <button key={m} aria-pressed={mode === m} onClick={() => changeMode(m)}>
              {S.mode[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="feed__screen" aria-live="polite" aria-label="Match commentary">
        {shown.map((line, i) => (
          <div
            key={i}
            className={`feed__line${line.includes("GOAL!") ? " feed__line--goal" : ""}`}
          >
            {line}
          </div>
        ))}
      </div>

      {mode === "fast" && (
        <div className="feed__controls">
          <button onClick={togglePlay}>{running ? S.pause : S.play}</button>
          <button onClick={restart}>{S.restart}</button>
          <button onClick={skip} disabled={atEnd}>
            {S.skip}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * MatchClock — maps wall-clock milliseconds to match minutes for playback.
 *
 * Pure time logic (no canvas). The director consumes `matchTimeMin`; the player
 * drives this from requestAnimationFrame deltas × playback rate.
 */

import type { MatchTimeline } from "../types.js";
import { RATE_NORMAL } from "./constants.js";

export type PlaybackState = "idle" | "playing" | "paused" | "ended";

export interface MatchClockOptions {
  /** Playback rate multiplier (1 = Normal, 2 = fast-forward). */
  rate?: number;
}

/** Last regulation/stoppage minute in the timeline. */
export function maxMatchMinute(timeline: MatchTimeline): number {
  let max = 0;
  for (const e of timeline.events) max = Math.max(max, e.t);
  return max;
}

export class MatchClock {
  private readonly timeline: MatchTimeline;
  private readonly durationMs: number;
  private readonly maxMin: number;
  private rate: number;
  private state: PlaybackState = "idle";
  private matchTimeMin = 0;
  private wallAnchorMs = 0;
  private matchAnchorMin = 0;

  constructor(timeline: MatchTimeline, options: MatchClockOptions = {}) {
    this.timeline = timeline;
    this.durationMs = Math.max(1, timeline.durationMs);
    this.maxMin = maxMatchMinute(timeline);
    this.rate = options.rate ?? RATE_NORMAL;
  }

  get playbackState(): PlaybackState {
    return this.state;
  }

  get playbackRate(): number {
    return this.rate;
  }

  get matchMinute(): number {
    return this.matchTimeMin;
  }

  get maxMinute(): number {
    return this.maxMin;
  }

  get totalDurationMs(): number {
    return this.durationMs;
  }

  setRate(rate: number): void {
    if (this.state === "playing") {
      this.syncAnchor();
    }
    this.rate = Math.max(0.25, rate);
  }

  play(): void {
    if (this.state === "ended") return;
    this.syncAnchor();
    this.state = "playing";
  }

  pause(): void {
    if (this.state === "playing") {
      this.syncAnchor();
      this.state = "paused";
    }
  }

  /** Jump to the final minute (FT / shootout). */
  skipToEnd(): void {
    this.matchTimeMin = this.maxMin;
    this.state = "ended";
  }

  /**
   * Seek to a match minute, clamped to [0, maxMinute].
   * Returns the clamped value actually applied.
   */
  seek(matchMin: number): number {
    const clamped = Math.max(0, Math.min(this.maxMin, matchMin));
    this.matchTimeMin = clamped;
    this.matchAnchorMin = clamped;
    this.wallAnchorMs = performance.now();
    if (clamped >= this.maxMin) this.state = "ended";
    else if (this.state === "ended") this.state = "paused";
    return clamped;
  }

  /** Advance by wall-clock delta; returns updated match minute. */
  tick(nowMs: number): number {
    if (this.state !== "playing") return this.matchTimeMin;

    const elapsedWall = nowMs - this.wallAnchorMs;
    const progress = (elapsedWall * this.rate) / this.durationMs;
    const next = this.matchAnchorMin + progress * this.maxMin;

    if (next >= this.maxMin) {
      this.matchTimeMin = this.maxMin;
      this.state = "ended";
      return this.matchTimeMin;
    }

    this.matchTimeMin = next;
    return this.matchTimeMin;
  }

  /** Replace the timeline (e.g. new simulation) and reset. */
  reset(timeline: MatchTimeline): void {
    Object.assign(this, new MatchClock(timeline, { rate: this.rate }));
  }

  private syncAnchor(): void {
    this.matchAnchorMin = this.matchTimeMin;
    this.wallAnchorMs = performance.now();
  }
}

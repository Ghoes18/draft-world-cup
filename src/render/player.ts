/**
 * MatchPlayer — orchestrates clock, director, and canvas renderer.
 *
 * Tiers (MVP §4.1):
 * - normal: 2D canvas animation
 * - fast: text ticker (accessibility path) — canvas hidden
 * - ultra: instant final score, no animation
 */

import type { MatchTimeline } from "../types.js";
import { toFastText } from "../consumers/fastText.js";
import { MatchClock } from "./clock.js";
import { directFrame, resetDirectorPlayback } from "./director.js";
import { CanvasRenderer } from "./canvasRenderer.js";
import { RATE_FAST, RATE_NORMAL } from "./constants.js";
import type { FrameState } from "./types.js";

export type SpeedTier = "normal" | "fast" | "ultra";

export interface MatchPlayerOptions {
  canvas: HTMLCanvasElement;
  /** Element that receives Fast-tier text lines. */
  textContainer?: HTMLElement;
  onFrame?: (frame: FrameState) => void;
  onEnd?: () => void;
  onFps?: (fps: number) => void;
}

const TIER_KEY = "7a0-tier";
const RATE_KEY = "7a0-rate";

export function loadPersistedTier(): SpeedTier {
  const v = localStorage.getItem(TIER_KEY);
  if (v === "fast" || v === "ultra" || v === "normal") return v;
  return "normal";
}

export function loadPersistedRate(): number {
  const v = Number(localStorage.getItem(RATE_KEY));
  return v === RATE_FAST ? RATE_FAST : RATE_NORMAL;
}

export function persistTier(tier: SpeedTier): void {
  localStorage.setItem(TIER_KEY, tier);
}

export function persistRate(rate: number): void {
  localStorage.setItem(RATE_KEY, String(rate));
}

export class MatchPlayer {
  private timeline: MatchTimeline;
  private readonly clock: MatchClock;
  private readonly renderer: CanvasRenderer;
  private readonly textContainer?: HTMLElement;
  private readonly onFrame?: (frame: FrameState) => void;
  private readonly onEnd?: () => void;
  private readonly onFps?: (fps: number) => void;

  private tier: SpeedTier = "normal";
  private rafId: number | null = null;
  private lastFpsTick = 0;
  private frameCount = 0;

  constructor(timeline: MatchTimeline, options: MatchPlayerOptions) {
    this.timeline = timeline;
    resetDirectorPlayback();
    this.clock = new MatchClock(timeline, { rate: loadPersistedRate() });
    this.renderer = new CanvasRenderer(options.canvas);
    if (options.textContainer !== undefined) this.textContainer = options.textContainer;
    if (options.onFrame !== undefined) this.onFrame = options.onFrame;
    if (options.onEnd !== undefined) this.onEnd = options.onEnd;
    if (options.onFps !== undefined) this.onFps = options.onFps;

    this.tier = loadPersistedTier();
    this.applyTier();
    this.renderCurrent();
  }

  getTier(): SpeedTier {
    return this.tier;
  }

  setTimeline(timeline: MatchTimeline): void {
    this.timeline = timeline;
    resetDirectorPlayback();
    this.clock.reset(timeline);
    this.renderCurrent();
  }

  setTier(tier: SpeedTier): void {
    this.tier = tier;
    persistTier(tier);
    this.applyTier();
    if (tier === "ultra") {
      this.clock.skipToEnd();
      this.renderCurrent();
      this.onEnd?.();
    } else {
      this.renderCurrent();
    }
  }

  setRate(rate: number): void {
    this.clock.setRate(rate);
    persistRate(rate);
  }

  play(): void {
    if (this.tier === "ultra") return;
    this.clock.play();
    this.startLoop();
  }

  pause(): void {
    this.clock.pause();
    this.stopLoop();
  }

  skipToEnd(): void {
    this.clock.skipToEnd();
    this.renderCurrent();
    this.onEnd?.();
  }

  seek(matchMin: number): number {
    const v = this.clock.seek(matchMin);
    this.renderCurrent();
    return v;
  }

  destroy(): void {
    this.stopLoop();
  }

  private applyTier(): void {
    const showCanvas = this.tier === "normal";
    this.renderer.canvas.style.display = showCanvas ? "block" : "none";

    if (this.textContainer) {
      this.textContainer.style.display = this.tier === "fast" ? "block" : "none";
      if (this.tier === "fast") {
        this.textContainer.textContent = toFastText(this.timeline).join("\n");
      }
    }
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    const tick = (now: number) => {
      this.clock.tick(now);
      this.renderCurrent();
      this.trackFps(now);
      if (this.clock.playbackState === "ended") {
        this.stopLoop();
        this.onEnd?.();
        return;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private trackFps(now: number): void {
    if (!this.onFps) return;
    this.frameCount++;
    if (now - this.lastFpsTick >= 1000) {
      this.onFps(this.frameCount);
      this.frameCount = 0;
      this.lastFpsTick = now;
    }
  }

  private renderCurrent(): void {
    const frame = directFrame(this.timeline, this.clock.matchMinute);
    if (this.tier === "normal") {
      const rect = this.renderer.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.renderer.resize(rect.width, rect.height);
      }
      this.renderer.draw(frame);
    }
    this.onFrame?.(frame);
  }
}

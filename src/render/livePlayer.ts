/**
 * LiveMatchPlayer — plays precomputed live snapshots on canvas.
 *
 * Separate from timeline MatchPlayer so solo deterministic replay stays intact.
 * Renders a continuously interpolated playhead between snapshots so the ball
 * and players move smoothly rather than jumping snapshot-to-snapshot.
 */

import { CanvasRenderer } from "./canvasRenderer.js";
import { snapshotToFrame } from "../live/snapshots.js";
import { interpolateFrame } from "./liveInterpolate.js";
import type { LiveSnapshot } from "../live/types.js";
import type { FrameState } from "./types.js";

export interface LiveMatchPlayerOptions {
  canvas: HTMLCanvasElement;
  onFrame?: (frame: FrameState) => void;
  onEnd?: () => void;
  onFps?: (fps: number) => void;
  /** Ms each snapshot occupies at 1×. Overrides the duration-derived default. */
  msPerSnapshot?: number;
  /** Target total playback duration at 1× when msPerSnapshot is omitted. */
  targetDurationMs?: number;
}

/** ~75 s at 1× sits inside the 60–90 s normal-tier window from the spec. */
const DEFAULT_TARGET_DURATION_MS = 75_000;

export class LiveMatchPlayer {
  private readonly snapshots: LiveSnapshot[];
  private readonly renderer: CanvasRenderer;
  private readonly onFrame?: (frame: FrameState) => void;
  private readonly onEnd?: () => void;
  private readonly onFps?: (fps: number) => void;
  private readonly msPerSnapshot: number;

  /** Fractional snapshot index — interpolated between floor and ceil. */
  private playhead = 0;
  private playing = false;
  private rafId: number | null = null;
  private lastTick = 0;
  private lastFpsTick = 0;
  private frameCount = 0;
  private rate = 1;

  constructor(snapshots: LiveSnapshot[], options: LiveMatchPlayerOptions) {
    this.snapshots = snapshots;
    this.renderer = new CanvasRenderer(options.canvas);
    const segments = Math.max(1, snapshots.length - 1);
    this.msPerSnapshot =
      options.msPerSnapshot ??
      Math.max(40, (options.targetDurationMs ?? DEFAULT_TARGET_DURATION_MS) / segments);
    if (options.onFrame !== undefined) this.onFrame = options.onFrame;
    if (options.onEnd !== undefined) this.onEnd = options.onEnd;
    if (options.onFps !== undefined) this.onFps = options.onFps;
    this.renderCurrent();
  }

  getSnapshotIndex(): number {
    return Math.floor(this.playhead);
  }

  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  setRate(rate: number): void {
    this.rate = rate > 0 ? rate : 1;
  }

  play(): void {
    if (this.playing) return;
    if (this.playhead >= this.snapshots.length - 1) this.playhead = 0;
    this.playing = true;
    this.lastTick = performance.now();
    this.loop(this.lastTick);
  }

  pause(): void {
    this.playing = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  skipToEnd(): void {
    this.playhead = this.snapshots.length - 1;
    this.renderCurrent();
    this.pause();
    this.onEnd?.();
  }

  destroy(): void {
    this.pause();
  }

  private loop(now: number): void {
    if (!this.playing) return;
    const elapsed = now - this.lastTick;
    this.lastTick = now;
    this.playhead += (elapsed / this.msPerSnapshot) * this.rate;

    const end = this.snapshots.length - 1;
    if (this.playhead >= end) {
      this.playhead = end;
      this.renderCurrent();
      this.trackFps(now);
      this.pause();
      this.onEnd?.();
      return;
    }

    this.renderCurrent();
    this.trackFps(now);
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  private trackFps(now: number): void {
    this.frameCount++;
    if (now - this.lastFpsTick >= 1000) {
      this.onFps?.(this.frameCount);
      this.frameCount = 0;
      this.lastFpsTick = now;
    }
  }

  private renderCurrent(): void {
    const frame = this.currentFrame();
    if (!frame) return;
    const rect = this.renderer.canvas.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
    this.renderer.draw(frame);
    this.onFrame?.(frame);
  }

  private currentFrame(): FrameState | null {
    const i = Math.floor(this.playhead);
    const a = this.snapshots[i];
    if (!a) return null;
    const b = this.snapshots[i + 1];
    if (!b) return snapshotToFrame(a);
    return interpolateFrame(a, b, this.playhead - i);
  }
}

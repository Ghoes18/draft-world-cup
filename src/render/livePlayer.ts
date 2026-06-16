/**
 * LiveMatchPlayer — plays precomputed live snapshots on canvas.
 *
 * Separate from timeline MatchPlayer so solo deterministic replay stays intact.
 */

import { CanvasRenderer } from "./canvasRenderer.js";
import { snapshotToFrame } from "../live/snapshots.js";
import type { LiveSnapshot } from "../live/types.js";
import type { FrameState } from "./types.js";

export interface LiveMatchPlayerOptions {
  canvas: HTMLCanvasElement;
  onFrame?: (frame: FrameState) => void;
  onEnd?: () => void;
  onFps?: (fps: number) => void;
  /** Ms per snapshot step at 1× (default compresses 90 min into ~75 s). */
  msPerSnapshot?: number;
}

const DEFAULT_MS_PER_SNAPSHOT = 85;

export class LiveMatchPlayer {
  private readonly snapshots: LiveSnapshot[];
  private readonly renderer: CanvasRenderer;
  private readonly onFrame?: (frame: FrameState) => void;
  private readonly onEnd?: () => void;
  private readonly onFps?: (fps: number) => void;
  private readonly msPerSnapshot: number;

  private index = 0;
  private playing = false;
  private rafId: number | null = null;
  private lastTick = 0;
  private lastFpsTick = 0;
  private frameCount = 0;
  private rate = 1;

  constructor(snapshots: LiveSnapshot[], options: LiveMatchPlayerOptions) {
    this.snapshots = snapshots;
    this.renderer = new CanvasRenderer(options.canvas);
    this.msPerSnapshot = options.msPerSnapshot ?? DEFAULT_MS_PER_SNAPSHOT;
    if (options.onFrame !== undefined) this.onFrame = options.onFrame;
    if (options.onEnd !== undefined) this.onEnd = options.onEnd;
    if (options.onFps !== undefined) this.onFps = options.onFps;
    this.renderCurrent();
  }

  getSnapshotIndex(): number {
    return this.index;
  }

  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  setRate(rate: number): void {
    this.rate = rate > 0 ? rate : 1;
  }

  play(): void {
    if (this.playing) return;
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
    this.index = this.snapshots.length - 1;
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
    const step = this.msPerSnapshot / this.rate;
    if (elapsed >= step) {
      this.lastTick = now - (elapsed % step);
      if (this.index < this.snapshots.length - 1) {
        this.index++;
        this.renderCurrent();
      } else {
        this.pause();
        this.onEnd?.();
        return;
      }
    }
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
    const snap = this.snapshots[this.index];
    if (!snap) return;
    const frame = snapshotToFrame(snap);
    const rect = this.renderer.canvas.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
    this.renderer.draw(frame);
    this.onFrame?.(frame);
  }
}

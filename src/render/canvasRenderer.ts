/**
 * Canvas drawer — FrameState → pixels. No timeline knowledge.
 */

import type { FrameState, RenderTheme } from "./types.js";
import { DEFAULT_THEME } from "./types.js";
import {
  applyDevicePixelRatio,
  layoutPitch,
  project2D,
  radiusFromFrac,
  type PitchRect,
} from "./project.js";
import { BALL_RADIUS_FRAC, TOKEN_RADIUS_FRAC } from "./constants.js";

export interface CanvasRendererOptions {
  theme?: RenderTheme;
}

export class CanvasRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly theme: RenderTheme;
  private pitch: PitchRect = { x: 0, y: 0, w: 1, h: 1 };
  private cssWidth = 1;
  private cssHeight = 1;
  private prevBall: { x: number; y: number } | null = null;

  constructor(canvas: HTMLCanvasElement, options: CanvasRendererOptions = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.canvas = canvas;
    this.ctx = ctx;
    this.theme = options.theme ?? DEFAULT_THEME;
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    applyDevicePixelRatio(this.canvas, cssWidth, cssHeight);
    this.pitch = layoutPitch(cssWidth, cssHeight);
  }

  draw(frame: FrameState): void {
    const { ctx, theme, pitch } = this;
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.fillStyle = "#0f1a12";
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    drawPitch(ctx, pitch, theme);
    drawTokens(ctx, pitch, frame, theme);
    drawBall(ctx, pitch, frame.ball, theme, this.prevBall);
    this.prevBall = { ...frame.ball };
    drawScoreboard(ctx, pitch, frame, theme);
    if (frame.banner) drawBanner(ctx, pitch, frame.banner, theme);
    drawClock(ctx, pitch, frame.matchTimeMin, theme);
  }
}

function drawPitch(
  ctx: CanvasRenderingContext2D,
  pitch: PitchRect,
  theme: RenderTheme,
): void {
  const { x, y, w, h } = pitch;
  ctx.fillStyle = theme.pitch;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = theme.pitchLine;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  // Halfway line
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.stroke();

  // Centre circle
  const r = h * 0.12;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
  ctx.stroke();

  // Penalty boxes (simplified)
  const boxW = w * 0.16;
  const boxH = h * 0.55;
  ctx.strokeRect(x, y + (h - boxH) / 2, boxW, boxH);
  ctx.strokeRect(x + w - boxW, y + (h - boxH) / 2, boxW, boxH);
}

function drawTokens(
  ctx: CanvasRenderingContext2D,
  pitch: PitchRect,
  frame: FrameState,
  theme: RenderTheme,
): void {
  const r = radiusFromFrac(TOKEN_RADIUS_FRAC, pitch);
  for (const tok of frame.tokens) {
    const p = project2D(tok.position, pitch);
    const isCarrier = tok.hasBall === true;

    if (isCarrier) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 120, 0.95)";
      ctx.lineWidth = 3;
      ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.fillStyle = tok.side === "home" ? theme.homeToken : theme.awayToken;
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = tok.side === "home" ? theme.homeText : theme.awayText;
    ctx.font = `bold ${Math.max(9, r * 1.1)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(tok.number), p.x, p.y);
  }
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  pitch: PitchRect,
  ball: { x: number; y: number },
  theme: RenderTheme,
  prevBall: { x: number; y: number } | null,
): void {
  const p = project2D(ball, pitch);
  const r = radiusFromFrac(BALL_RADIUS_FRAC, pitch);

  if (prevBall) {
    const pp = project2D(prevBall, pitch);
    const dx = p.x - pp.x;
    const dy = p.y - pp.y;
    const speed = Math.hypot(dx, dy);
    if (speed > 4) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = Math.max(1, r * 0.6);
      ctx.moveTo(pp.x, pp.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }

  ctx.beginPath();
  ctx.fillStyle = theme.ball;
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawScoreboard(
  ctx: CanvasRenderingContext2D,
  pitch: PitchRect,
  frame: FrameState,
  theme: RenderTheme,
): void {
  const label = `${frame.score[0]} – ${frame.score[1]}`;
  const pad = 8;
  ctx.font = "bold 18px system-ui, sans-serif";
  const tw = ctx.measureText(label).width;
  const bx = pitch.x + pitch.w / 2 - tw / 2 - pad;
  const by = pitch.y + 6;
  const bw = tw + pad * 2;
  const bh = 28;

  ctx.fillStyle = theme.scoreBg;
  roundRect(ctx, bx, by, bw, bh, 6);
  ctx.fill();

  ctx.fillStyle = theme.scoreText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, pitch.x + pitch.w / 2, by + bh / 2);
}

function drawBanner(
  ctx: CanvasRenderingContext2D,
  pitch: PitchRect,
  text: string,
  theme: RenderTheme,
): void {
  ctx.font = "bold 22px system-ui, sans-serif";
  const tw = ctx.measureText(text).width;
  const pad = 14;
  const bw = tw + pad * 2;
  const bh = 36;
  const bx = pitch.x + pitch.w / 2 - bw / 2;
  const by = pitch.y + pitch.h / 2 - bh / 2;

  ctx.fillStyle = theme.bannerBg;
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fill();

  ctx.fillStyle = theme.bannerText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, pitch.x + pitch.w / 2, by + bh / 2);
}

function drawClock(
  ctx: CanvasRenderingContext2D,
  pitch: PitchRect,
  matchTimeMin: number,
  theme: RenderTheme,
): void {
  const label = formatClock(matchTimeMin);
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillStyle = theme.scoreText;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(label, pitch.x + pitch.w - 8, pitch.y + 10);
}

function formatClock(t: number): string {
  const m = Math.floor(t);
  if (m > 90) return `90+${m - 90}'`;
  return `${m}'`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

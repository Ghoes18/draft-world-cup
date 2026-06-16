import type { Vec2 } from "../types.js";
import { PITCH_PADDING_PX } from "./constants.js";

export interface PitchRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
}

/** Layout the pitch inside a CSS-pixel canvas, letterboxed to 105:68 aspect. */
export function layoutPitch(
  cssWidth: number,
  cssHeight: number,
  padding = PITCH_PADDING_PX,
): PitchRect {
  const innerW = Math.max(1, cssWidth - padding * 2);
  const innerH = Math.max(1, cssHeight - padding * 2);
  const aspect = 105 / 68;
  let w = innerW;
  let h = w / aspect;
  if (h > innerH) {
    h = innerH;
    w = h * aspect;
  }
  const x = (cssWidth - w) / 2;
  const y = (cssHeight - h) / 2;
  return { x, y, w, h };
}

/** Map normalized pitch coords (x length, y width) to canvas CSS pixels. */
export function project2D(v: Vec2, pitch: PitchRect): ProjectedPoint {
  return {
    x: pitch.x + v.x * pitch.w,
    y: pitch.y + v.y * pitch.h,
  };
}

/** Apply devicePixelRatio so canvas backing store matches physical pixels. */
export function applyDevicePixelRatio(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
): number {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return dpr;
}

/** Radius in CSS px from a fraction of the pitch short side. */
export function radiusFromFrac(frac: number, pitch: PitchRect): number {
  return frac * Math.min(pitch.w, pitch.h);
}

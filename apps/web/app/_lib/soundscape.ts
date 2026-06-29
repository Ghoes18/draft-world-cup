/**
 * Procedural soundscape — all UI cues are synthesized with the Web Audio API,
 * so there are no audio files to ship or license. A single shared AudioContext
 * is created lazily on the first cue (which always happens inside a user
 * gesture, satisfying browser autoplay policy).
 *
 * Mute state lives here so it survives component remounts; `useSound` mirrors
 * it into React + localStorage.
 */

export type SoundCue =
  | "pick"
  | "placeStandard"
  | "placeElite"
  | "placeLegend"
  | "placeIcon"
  | "placeTsubasa"
  | "error"
  | "whistle"
  | "goal";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ensureCtx(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return master ? { ctx, master } : null;
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

/** A single enveloped oscillator note. */
function tone(
  ac: AudioContext,
  out: GainNode,
  opts: {
    freq: number;
    start: number;
    dur: number;
    type?: OscillatorType;
    peak?: number;
    slideTo?: number;
  },
): void {
  const { freq, start, dur, type = "sine", peak = 0.2, slideTo } = opts;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + dur);
  }
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** A short band-passed noise burst (whoosh / smoke / cheer texture). */
function noise(
  ac: AudioContext,
  out: GainNode,
  opts: { start: number; dur: number; peak?: number; filter?: number; q?: number },
): void {
  const { start, dur, peak = 0.15, filter = 1200, q = 0.8 } = opts;
  const frames = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = filter;
  bp.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(bp).connect(g).connect(out);
  src.start(start);
  src.stop(start + dur + 0.02);
}

export function playCue(cue: SoundCue): void {
  if (muted) return;
  const engine = ensureCtx();
  if (!engine) return;
  const { ctx: ac, master: out } = engine;
  const t = ac.currentTime;

  switch (cue) {
    case "pick":
      tone(ac, out, { freq: 660, start: t, dur: 0.07, type: "triangle", peak: 0.12 });
      break;

    case "placeStandard":
      tone(ac, out, { freq: 180, start: t, dur: 0.16, type: "sine", peak: 0.28, slideTo: 90 });
      noise(ac, out, { start: t, dur: 0.18, peak: 0.1, filter: 900 });
      break;

    case "placeElite":
      // rising bell chime
      tone(ac, out, { freq: 523, start: t, dur: 0.18, type: "triangle", peak: 0.18 });
      tone(ac, out, { freq: 784, start: t + 0.08, dur: 0.22, type: "triangle", peak: 0.16 });
      tone(ac, out, { freq: 1046, start: t + 0.16, dur: 0.26, type: "sine", peak: 0.12 });
      break;

    case "placeLegend": {
      // sparkle arpeggio + shimmer
      const notes = [784, 988, 1175, 1568, 1976];
      notes.forEach((f, i) =>
        tone(ac, out, {
          freq: f,
          start: t + i * 0.06,
          dur: 0.3,
          type: "triangle",
          peak: 0.13,
        }),
      );
      noise(ac, out, { start: t + 0.1, dur: 0.5, peak: 0.05, filter: 6000, q: 1.5 });
      break;
    }

    case "placeIcon": {
      // deep, slow choir-like swell (minor-ish low chord)
      [131, 196, 247].forEach((f) =>
        tone(ac, out, { freq: f, start: t, dur: 0.9, type: "sawtooth", peak: 0.1 }),
      );
      tone(ac, out, { freq: 65, start: t, dur: 1.0, type: "sine", peak: 0.18 });
      noise(ac, out, { start: t, dur: 0.9, peak: 0.04, filter: 400, q: 0.6 });
      break;
    }

    case "placeTsubasa": {
      // Anime "special move" sting — the blue-flame easter egg. A charge swoosh
      // igniting into an impact boom, a heroic major-chord stab, then a rising
      // "kira-kira" sparkle tail.
      noise(ac, out, { start: t, dur: 0.22, peak: 0.13, filter: 1800, q: 0.7 });
      tone(ac, out, {
        freq: 90,
        start: t + 0.16,
        dur: 0.5,
        type: "sine",
        peak: 0.26,
        slideTo: 45,
      });
      noise(ac, out, { start: t + 0.16, dur: 0.26, peak: 0.18, filter: 2600, q: 0.8 });
      [659, 831, 988, 1319].forEach((f, i) =>
        tone(ac, out, {
          freq: f,
          start: t + 0.18 + i * 0.012,
          dur: 0.5,
          type: "triangle",
          peak: 0.16,
        }),
      );
      [1319, 1568, 1976, 2637].forEach((f, i) =>
        tone(ac, out, {
          freq: f,
          start: t + 0.34 + i * 0.05,
          dur: 0.3,
          type: "sine",
          peak: 0.1,
        }),
      );
      break;
    }

    case "error":
      tone(ac, out, { freq: 150, start: t, dur: 0.16, type: "square", peak: 0.14, slideTo: 90 });
      break;

    case "whistle":
      // two short referee pips with a touch of vibrato-ish slide
      tone(ac, out, { freq: 2100, start: t, dur: 0.14, type: "square", peak: 0.1, slideTo: 2300 });
      tone(ac, out, { freq: 2100, start: t + 0.2, dur: 0.24, type: "square", peak: 0.1, slideTo: 2350 });
      noise(ac, out, { start: t, dur: 0.5, peak: 0.03, filter: 2200, q: 4 });
      break;

    case "goal": {
      // ascending swell + crowd-like noise crescendo
      tone(ac, out, { freq: 392, start: t, dur: 0.5, type: "sawtooth", peak: 0.16, slideTo: 784 });
      noise(ac, out, { start: t, dur: 0.7, peak: 0.12, filter: 1500, q: 0.5 });
      break;
    }
  }
}

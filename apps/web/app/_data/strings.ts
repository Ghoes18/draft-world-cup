/**
 * Centralised UI strings. Demo ships English only; keeping them in one map lets
 * later locales (PT/ES, MVP RNF-7) drop in without a framework rewrite.
 */
export const STRINGS = {
  title: "7a0 — Match Viewer",
  subtitle: "Roll a fixture, simulate, and read the match as text — like the original 7a0.",
  roll: "Roll fixture",
  simulate: "Simulate",
  vs: "vs",
  noMatch: "Roll a fixture and simulate to begin.",
  build: {
    heading: "Build",
    tactic: "Tactic",
    offensive: "Offensive",
    balanced: "Balanced",
    defensive: "Defensive",
    chemistry: "Chemistry",
    effective: "Effective",
    lambda: "Expected goals (λ)",
    atk: "ATK",
    def: "DEF",
    ovr: "OVR",
  },
  mode: { fast: "Ticker (minute-by-minute)", ultra: "Instant result" },
  play: "Play",
  pause: "Pause",
  restart: "Restart",
  skip: "Skip to result",
} as const;

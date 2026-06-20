/**
 * Public API for the 7a0 engine + timeline (MVP M1).
 *
 * Three decoupled layers: ENGINE (numbers) → TIMELINE (events) → consumers.
 * Everything is pure and deterministic in the seed, so it runs server-side
 * unchanged for online + daily (server authority, PRD §9.1).
 */

export * from "./types.js";
export * from "./constants.js";
export * from "./rng.js";
export { poissonKnuth } from "./poisson.js";
export * from "./engine.js";
export * from "./chemistry.js";
export * from "./strength.js";
export * from "./formations.js";
export * from "./lineup.js";
export { generateTimeline } from "./timeline/generate.js";
export type { GenerateTimelineInput } from "./timeline/generate.js";
export { toFastText } from "./consumers/fastText.js";
export type { FastTextOptions } from "./consumers/fastText.js";
export { computeMatchStats } from "./consumers/stats.js";
export type { MatchStats, TeamStats } from "./consumers/stats.js";
export * from "./catalog.js";
export * from "./catalog/liveImport.js";
export * from "./positions.js";
export * from "./lineupStrength.js";
export * from "./roll.js";
export { demoCatalog } from "./demoCatalog.js";

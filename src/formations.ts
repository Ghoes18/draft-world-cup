/**
 * Formation catalog for Build / Draft (FIFA Draft-style picker).
 *
 * Anchors use the home-attacking-right frame: x = own-goal→opponent-goal,
 * y = pitch width (smaller y = right flank when attacking right).
 */

import { pick, rngFromSeed } from "./rng.js";
import type { Vec2 } from "./types.js";

export type FormationMentality = "defensive" | "balanced" | "offensive";

export interface FormationSlotSpec {
  position: string;
  anchor: Vec2;
}

export interface FormationDefinition {
  id: string;
  label: string;
  baseShape: string;
  mentality: FormationMentality;
  description: string;
  slots: readonly FormationSlotSpec[];
}

export const DEFAULT_FORMATION_ID = "433-balanced";

const GK: FormationSlotSpec = { position: "GK", anchor: { x: 0.05, y: 0.5 } };

function backFour(depth = 0.22): FormationSlotSpec[] {
  return [
    { position: "RB", anchor: { x: depth + 0.03, y: 0.15 } },
    { position: "RCB", anchor: { x: depth, y: 0.38 } },
    { position: "LCB", anchor: { x: depth, y: 0.62 } },
    { position: "LB", anchor: { x: depth + 0.03, y: 0.85 } },
  ];
}

const FORMATIONS: FormationDefinition[] = [
  {
    id: "433-balanced",
    label: "4-3-3",
    baseShape: "4-3-3",
    mentality: "balanced",
    description: "Classic width with a flat midfield three.",
    slots: [
      GK,
      ...backFour(),
      { position: "RCM", anchor: { x: 0.45, y: 0.3 } },
      { position: "CM", anchor: { x: 0.42, y: 0.5 } },
      { position: "LCM", anchor: { x: 0.45, y: 0.7 } },
      { position: "RW", anchor: { x: 0.72, y: 0.2 } },
      { position: "ST", anchor: { x: 0.78, y: 0.5 } },
      { position: "LW", anchor: { x: 0.72, y: 0.8 } },
    ],
  },
  {
    id: "433-defend",
    label: "4-3-3 Defend",
    baseShape: "4-3-3",
    mentality: "defensive",
    description: "Holding CDM shields the back four.",
    slots: [
      GK,
      ...backFour(),
      { position: "CDM", anchor: { x: 0.34, y: 0.5 } },
      { position: "RCM", anchor: { x: 0.44, y: 0.32 } },
      { position: "LCM", anchor: { x: 0.44, y: 0.68 } },
      { position: "RW", anchor: { x: 0.7, y: 0.22 } },
      { position: "ST", anchor: { x: 0.76, y: 0.5 } },
      { position: "LW", anchor: { x: 0.7, y: 0.78 } },
    ],
  },
  {
    id: "433-attack",
    label: "4-3-3 Attack",
    baseShape: "4-3-3",
    mentality: "offensive",
    description: "Advanced CAM links the front three.",
    slots: [
      GK,
      ...backFour(),
      { position: "RCM", anchor: { x: 0.4, y: 0.34 } },
      { position: "LCM", anchor: { x: 0.4, y: 0.66 } },
      { position: "CAM", anchor: { x: 0.58, y: 0.5 } },
      { position: "RW", anchor: { x: 0.76, y: 0.18 } },
      { position: "ST", anchor: { x: 0.82, y: 0.5 } },
      { position: "LW", anchor: { x: 0.76, y: 0.82 } },
    ],
  },
  {
    id: "433-false9",
    label: "4-3-3 False 9",
    baseShape: "4-3-3",
    mentality: "offensive",
    description: "False nine drops to link wide forwards.",
    slots: [
      GK,
      ...backFour(),
      { position: "RCM", anchor: { x: 0.43, y: 0.3 } },
      { position: "CM", anchor: { x: 0.4, y: 0.5 } },
      { position: "LCM", anchor: { x: 0.43, y: 0.7 } },
      { position: "RW", anchor: { x: 0.74, y: 0.22 } },
      { position: "CF", anchor: { x: 0.62, y: 0.5 } },
      { position: "LW", anchor: { x: 0.74, y: 0.78 } },
    ],
  },
  {
    id: "4231-balanced",
    label: "4-2-3-1",
    baseShape: "4-2-3-1",
    mentality: "balanced",
    description: "Double pivot with a no.10 behind the striker.",
    slots: [
      GK,
      ...backFour(),
      { position: "RCDM", anchor: { x: 0.36, y: 0.4 } },
      { position: "LCDM", anchor: { x: 0.36, y: 0.6 } },
      { position: "RAM", anchor: { x: 0.58, y: 0.22 } },
      { position: "CAM", anchor: { x: 0.6, y: 0.5 } },
      { position: "LAM", anchor: { x: 0.58, y: 0.78 } },
      { position: "ST", anchor: { x: 0.78, y: 0.5 } },
    ],
  },
  {
    id: "442-balanced",
    label: "4-4-2",
    baseShape: "4-4-2",
    mentality: "balanced",
    description: "Two banks of four with a classic strike pair.",
    slots: [
      GK,
      ...backFour(),
      { position: "RM", anchor: { x: 0.48, y: 0.18 } },
      { position: "RCM", anchor: { x: 0.46, y: 0.38 } },
      { position: "LCM", anchor: { x: 0.46, y: 0.62 } },
      { position: "LM", anchor: { x: 0.48, y: 0.82 } },
      { position: "RST", anchor: { x: 0.76, y: 0.42 } },
      { position: "LST", anchor: { x: 0.76, y: 0.58 } },
    ],
  },
  {
    id: "442-holding",
    label: "4-4-2 Holding",
    baseShape: "4-4-2",
    mentality: "defensive",
    description: "Anchor CDM sits between the midfield four.",
    slots: [
      GK,
      ...backFour(),
      { position: "CDM", anchor: { x: 0.34, y: 0.5 } },
      { position: "RM", anchor: { x: 0.48, y: 0.2 } },
      { position: "CM", anchor: { x: 0.44, y: 0.5 } },
      { position: "LM", anchor: { x: 0.48, y: 0.8 } },
      { position: "RST", anchor: { x: 0.74, y: 0.42 } },
      { position: "LST", anchor: { x: 0.74, y: 0.58 } },
    ],
  },
  {
    id: "352-balanced",
    label: "3-5-2",
    baseShape: "3-5-2",
    mentality: "balanced",
    description: "Wing-backs provide width in a compact middle.",
    slots: [
      GK,
      { position: "RCB", anchor: { x: 0.2, y: 0.32 } },
      { position: "CB", anchor: { x: 0.18, y: 0.5 } },
      { position: "LCB", anchor: { x: 0.2, y: 0.68 } },
      { position: "RWB", anchor: { x: 0.42, y: 0.12 } },
      { position: "RCM", anchor: { x: 0.44, y: 0.38 } },
      { position: "CM", anchor: { x: 0.4, y: 0.5 } },
      { position: "LCM", anchor: { x: 0.44, y: 0.62 } },
      { position: "LWB", anchor: { x: 0.42, y: 0.88 } },
      { position: "RST", anchor: { x: 0.76, y: 0.42 } },
      { position: "LST", anchor: { x: 0.76, y: 0.58 } },
    ],
  },
  {
    id: "532-defensive",
    label: "5-3-2",
    baseShape: "5-3-2",
    mentality: "defensive",
    description: "Five at the back with wing-backs joining two strikers.",
    slots: [
      GK,
      { position: "RCB", anchor: { x: 0.2, y: 0.28 } },
      { position: "CB", anchor: { x: 0.17, y: 0.5 } },
      { position: "LCB", anchor: { x: 0.2, y: 0.72 } },
      { position: "RWB", anchor: { x: 0.32, y: 0.12 } },
      { position: "LWB", anchor: { x: 0.32, y: 0.88 } },
      { position: "RCM", anchor: { x: 0.44, y: 0.35 } },
      { position: "CM", anchor: { x: 0.42, y: 0.5 } },
      { position: "LCM", anchor: { x: 0.44, y: 0.65 } },
      { position: "RST", anchor: { x: 0.72, y: 0.42 } },
      { position: "LST", anchor: { x: 0.72, y: 0.58 } },
    ],
  },
  {
    id: "451-defensive",
    label: "4-5-1",
    baseShape: "4-5-1",
    mentality: "defensive",
    description: "Packed midfield five with a lone target.",
    slots: [
      GK,
      ...backFour(),
      { position: "RM", anchor: { x: 0.46, y: 0.15 } },
      { position: "RCM", anchor: { x: 0.42, y: 0.35 } },
      { position: "CM", anchor: { x: 0.4, y: 0.5 } },
      { position: "LCM", anchor: { x: 0.42, y: 0.65 } },
      { position: "LM", anchor: { x: 0.46, y: 0.85 } },
      { position: "ST", anchor: { x: 0.76, y: 0.5 } },
    ],
  },
  {
    id: "424-offensive",
    label: "4-2-4",
    baseShape: "4-2-4",
    mentality: "offensive",
    description: "Two pivots feed a front four on the break.",
    slots: [
      GK,
      ...backFour(),
      { position: "RCM", anchor: { x: 0.4, y: 0.4 } },
      { position: "LCM", anchor: { x: 0.4, y: 0.6 } },
      { position: "RW", anchor: { x: 0.72, y: 0.18 } },
      { position: "RST", anchor: { x: 0.78, y: 0.42 } },
      { position: "LST", anchor: { x: 0.78, y: 0.58 } },
      { position: "LW", anchor: { x: 0.72, y: 0.82 } },
    ],
  },
  {
    id: "343-offensive",
    label: "3-4-3",
    baseShape: "3-4-3",
    mentality: "offensive",
    description: "Three at the back with a wide midfield diamond.",
    slots: [
      GK,
      { position: "RCB", anchor: { x: 0.2, y: 0.32 } },
      { position: "CB", anchor: { x: 0.18, y: 0.5 } },
      { position: "LCB", anchor: { x: 0.2, y: 0.68 } },
      { position: "RM", anchor: { x: 0.46, y: 0.15 } },
      { position: "RCM", anchor: { x: 0.44, y: 0.38 } },
      { position: "LCM", anchor: { x: 0.44, y: 0.62 } },
      { position: "LM", anchor: { x: 0.46, y: 0.85 } },
      { position: "RW", anchor: { x: 0.74, y: 0.22 } },
      { position: "ST", anchor: { x: 0.8, y: 0.5 } },
      { position: "LW", anchor: { x: 0.74, y: 0.78 } },
    ],
  },
];

const BY_ID = new Map(FORMATIONS.map((f) => [f.id, f]));

/** All formations in the catalog. */
export function listFormations(): readonly FormationDefinition[] {
  return FORMATIONS;
}

/** Lookup a formation by id; throws if unknown. */
export function getFormation(formationId: string): FormationDefinition {
  const f = BY_ID.get(formationId);
  if (!f) throw new Error(`Unknown formation: ${formationId}`);
  return f;
}

/** Slot anchor specs for a formation (defaults to 4-3-3 balanced). */
export function formationAnchors(
  formationId: string = DEFAULT_FORMATION_ID,
): readonly FormationSlotSpec[] {
  return getFormation(formationId).slots;
}

/**
 * Draw `count` distinct formation options for a draft run (FIFA Draft style).
 * Deterministic for the same seed.
 */
export function drawFormationOptions(
  seed: string,
  count = 5,
): FormationDefinition[] {
  const rng = rngFromSeed(`${seed}:formations`);
  const pool = [...FORMATIONS];
  const n = Math.min(count, pool.length);
  const out: FormationDefinition[] = [];
  for (let i = 0; i < n; i++) {
    const chosen = pick(rng, pool);
    out.push(chosen);
    const idx = pool.indexOf(chosen);
    pool.splice(idx, 1);
  }
  return out;
}

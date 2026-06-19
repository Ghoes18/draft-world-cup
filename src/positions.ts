/**
 * 7a0 position codes and attack/defense weights for lineup aggregation.
 *
 * Maps FIFA-style field codes (GK, RB, ST…) to 7a0 codes (GR, LD, PE…) and
 * the live-game weight tables used to derive attack/defense from the XI.
 */

/** Canonical 7a0 position codes used for weight lookup. */
export type Pos7a0 =
  | "GR"
  | "LD"
  | "LE"
  | "ZAG"
  | "VOL"
  | "MC"
  | "MD"
  | "ME"
  | "MEI"
  | "PD"
  | "CA"
  | "PE";

const ATTACK_WEIGHT: Record<Pos7a0, number> = {
  GR: 0,
  LD: 0,
  LE: 0,
  ZAG: 0,
  VOL: 0.2,
  MC: 0.5,
  MD: 0.5,
  ME: 0.5,
  MEI: 0.8,
  PD: 1,
  CA: 1,
  PE: 1,
};

const DEFENSE_WEIGHT: Record<Pos7a0, number> = {
  GR: 1,
  LD: 1,
  LE: 1,
  ZAG: 1,
  VOL: 0.8,
  MC: 0.5,
  MD: 0.5,
  ME: 0.5,
  MEI: 0.2,
  PD: 0,
  CA: 0,
  PE: 0,
};

/** Map a field/natural position string to a 7a0 code. */
export function toPos7a0(position: string): Pos7a0 {
  const p = position.trim().toUpperCase();
  if (p === "GR" || p === "GK") return "GR";
  if (p === "LD" || p === "RB") return "LD";
  if (p === "LE" || p === "LB") return "LE";
  if (p === "ZAG" || p === "CB" || p === "RCB" || p === "LCB") return "ZAG";
  if (p === "VOL" || p === "DM" || p === "CDM") return "VOL";
  if (p === "MC" || p === "CM" || p === "RCM" || p === "LCM") return "MC";
  if (p === "MD") return "MD";
  if (p === "ME") return "ME";
  if (p === "MEI" || p === "AM" || p === "CAM") return "MEI";
  if (p === "PD" || p === "RW" || p === "LW" || p === "W" || p === "WF")
    return "PD";
  if (p === "CA") return "CA";
  if (p === "PE" || p === "ST" || p === "CF" || p === "FW") return "PE";
  // Unknown → treat as balanced midfielder.
  return "MC";
}

export function attackWeight(position: string): number {
  return ATTACK_WEIGHT[toPos7a0(position)];
}

export function defenseWeight(position: string): number {
  return DEFENSE_WEIGHT[toPos7a0(position)];
}

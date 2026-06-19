/**
 * Deterministic roll + build layer.
 *
 * Scenario roll: one *(team, Cup)* per match.
 * Slot roll: per-position candidate batches from that scenario's squad.
 * All randomness derives from the server-owned seed string (mulberry32).
 */

import {
  canonicalRole,
  chemistryPercent,
  positionFit,
} from "./chemistry.js";
import {
  CANDIDATES_PER_SLOT,
  EMERGENCY_REROLLS_TOTAL,
  REROLLS_PER_SLOT,
} from "./constants.js";
import {
  getPlayer,
  getScenario,
  scenarioPlayers,
  type PlayerCard,
  type SquadCatalog,
  type SquadScenario,
} from "./catalog.js";
import { formationAnchors } from "./lineup.js";
import { pick, randInt, rngFromSeed } from "./rng.js";
import type { LineupSlot, Side, Vec2 } from "./types.js";

/** One XI slot during Build. */
export interface BuildSlot {
  slotId: string;
  position: string;
  anchor: Vec2;
  /** Increments on each reroll; drives deterministic candidate batches. */
  rollIndex: number;
  rerollsUsed: number;
  emergencyUsed: boolean;
  selectedPlayerId?: string;
}

/** In-progress Build state for one side. */
export interface BuildState {
  seed: string;
  scenarioId: string;
  side: Side;
  slots: BuildSlot[];
  emergencyRerollsRemaining: number;
}

export interface LineupValidationError {
  code:
    | "wrong_scenario"
    | "duplicate_player"
    | "unknown_player"
    | "incomplete";
  message: string;
  playerId?: string;
}

export interface LineupValidationResult {
  ok: boolean;
  errors: LineupValidationError[];
}

function slotRng(
  seed: string,
  scenarioId: string,
  slotId: string,
  rollIndex: number,
) {
  return rngFromSeed(
    `${seed}:scenario:${scenarioId}:slot:${slotId}:roll:${rollIndex}`,
  );
}

function scenarioDrawRng(seed: string) {
  return rngFromSeed(`${seed}:draw`);
}

/** Draw one scenario from the catalog (scenario roll). */
export function drawScenario(
  catalog: SquadCatalog,
  seed: string,
): SquadScenario {
  if (catalog.scenarios.length === 0) {
    throw new Error("drawScenario: empty catalog");
  }
  const rng = scenarioDrawRng(seed);
  return pick(rng, catalog.scenarios);
}

/**
 * Draw a second scenario for an opponent, avoiding the player's scenario when
 * possible (demo / CPU opponent).
 */
export function drawOpponentScenario(
  catalog: SquadCatalog,
  seed: string,
  playerScenarioId: string,
): SquadScenario {
  const pool = catalog.scenarios.filter((s) => s.id !== playerScenarioId);
  const rng = rngFromSeed(`${seed}:opponent`);
  if (pool.length === 0) return getScenario(catalog, playerScenarioId);
  return pick(rng, pool);
}

/** Initialize Build state with empty slots for a 4-3-3 formation. */
export function initBuildState(
  catalog: SquadCatalog,
  scenarioId: string,
  seed: string,
  side: Side,
): BuildState {
  getScenario(catalog, scenarioId);
  const anchors = formationAnchors();
  const slots: BuildSlot[] = anchors.map((spec, i) => {
    const x = side === "home" ? spec.anchor.x : 1 - spec.anchor.x;
    return {
      slotId: String(i),
      position: spec.position,
      anchor: { x, y: spec.anchor.y },
      rollIndex: 0,
      rerollsUsed: 0,
      emergencyUsed: false,
    };
  });
  return {
    seed,
    scenarioId,
    side,
    slots,
    emergencyRerollsRemaining: EMERGENCY_REROLLS_TOTAL,
  };
}

function selectedPlayerIds(state: BuildState): Set<string> {
  const ids = new Set<string>();
  for (const slot of state.slots) {
    if (slot.selectedPlayerId) ids.add(slot.selectedPlayerId);
  }
  return ids;
}

function roleFitScore(natural: string, slotPosition: string): number {
  return positionFit(natural, slotPosition);
}

/** Pool of squad players not yet selected, preferring position fit. */
function eligiblePool(
  catalog: SquadCatalog,
  scenarioId: string,
  slotPosition: string,
  excluded: Set<string>,
): PlayerCard[] {
  const all = scenarioPlayers(catalog, scenarioId).filter(
    (p) => !excluded.has(p.id),
  );
  const slotRole = canonicalRole(slotPosition);
  const sorted = [...all].sort((a, b) => {
    const fitA = roleFitScore(a.naturalPosition, slotPosition);
    const fitB = roleFitScore(b.naturalPosition, slotPosition);
    if (fitB !== fitA) return fitB - fitA;
    return a.name.localeCompare(b.name);
  });
  // Prefer players who can play this slot (exact or adjacent role).
  if (slotRole) {
    const fitting = sorted.filter(
      (p) => roleFitScore(p.naturalPosition, slotPosition) >= 0.5,
    );
    if (fitting.length >= CANDIDATES_PER_SLOT) return fitting;
  }
  return sorted;
}

function sampleCandidates(
  pool: PlayerCard[],
  seed: string,
  scenarioId: string,
  slotId: string,
  rollIndex: number,
): PlayerCard[] {
  if (pool.length === 0) return [];
  const rng = slotRng(seed, scenarioId, slotId, rollIndex);
  const copy = [...pool];
  const count = Math.min(CANDIDATES_PER_SLOT, copy.length);
  const out: PlayerCard[] = [];
  for (let i = 0; i < count; i++) {
    const idx = randInt(rng, 0, copy.length - 1);
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
}

/** Slot roll — deterministic candidate batch for one position. */
export function rollSlotCandidates(
  catalog: SquadCatalog,
  state: BuildState,
  slotId: string,
): PlayerCard[] {
  const slot = state.slots.find((s) => s.slotId === slotId);
  if (!slot) throw new Error(`unknown slot: ${slotId}`);
  const excluded = selectedPlayerIds(state);
  const pool = eligiblePool(
    catalog,
    state.scenarioId,
    slot.position,
    excluded,
  );
  return sampleCandidates(
    pool,
    state.seed,
    state.scenarioId,
    slotId,
    slot.rollIndex,
  );
}

/** All slot candidate batches keyed by slotId. */
export function allSlotCandidates(
  catalog: SquadCatalog,
  state: BuildState,
): Record<string, PlayerCard[]> {
  const out: Record<string, PlayerCard[]> = {};
  for (const slot of state.slots) {
    out[slot.slotId] = rollSlotCandidates(catalog, state, slot.slotId);
  }
  return out;
}

function updateSlot(
  state: BuildState,
  slotId: string,
  patch: Partial<BuildSlot>,
): BuildState {
  return {
    ...state,
    slots: state.slots.map((s) =>
      s.slotId === slotId ? { ...s, ...patch } : s,
    ),
  };
}

/** Reroll candidates for a slot (normal or emergency). */
export function rerollSlot(
  state: BuildState,
  slotId: string,
  emergency = false,
): BuildState {
  const slot = state.slots.find((s) => s.slotId === slotId);
  if (!slot) throw new Error(`unknown slot: ${slotId}`);
  if (slot.selectedPlayerId) return state;

  if (emergency) {
    if (state.emergencyRerollsRemaining <= 0) {
      throw new Error("no emergency rerolls remaining");
    }
    if (slot.emergencyUsed) {
      throw new Error("emergency reroll already used on this slot");
    }
    const next = updateSlot(state, slotId, {
      rollIndex: slot.rollIndex + 1,
      emergencyUsed: true,
    });
    return {
      ...next,
      emergencyRerollsRemaining: state.emergencyRerollsRemaining - 1,
    };
  }

  if (slot.rerollsUsed >= REROLLS_PER_SLOT) {
    throw new Error("reroll limit reached for this slot");
  }
  return updateSlot(state, slotId, {
    rollIndex: slot.rollIndex + 1,
    rerollsUsed: slot.rerollsUsed + 1,
  });
}

/** Select a player for a slot. */
export function selectPlayer(
  catalog: SquadCatalog,
  state: BuildState,
  slotId: string,
  playerId: string,
): BuildState {
  const slot = state.slots.find((s) => s.slotId === slotId);
  if (!slot) throw new Error(`unknown slot: ${slotId}`);

  const player = getPlayer(catalog, playerId);
  const scenario = getScenario(catalog, state.scenarioId);
  if (player.team !== scenario.team || player.cup !== scenario.cup) {
    throw new Error(`player ${playerId} not eligible for scenario`);
  }
  if (!scenario.playerIds.includes(playerId)) {
    throw new Error(`player ${playerId} not in scenario squad`);
  }

  const taken = selectedPlayerIds(state);
  if (taken.has(playerId) && slot.selectedPlayerId !== playerId) {
    throw new Error(`player ${playerId} already selected`);
  }

  const candidates = rollSlotCandidates(catalog, state, slotId);
  if (!candidates.some((c) => c.id === playerId)) {
    throw new Error(`player ${playerId} not in current candidate batch`);
  }

  return updateSlot(state, slotId, { selectedPlayerId: playerId });
}

/** Chemistry % from current selections (0 if incomplete). */
export function buildChemistryPercent(
  catalog: SquadCatalog,
  state: BuildState,
): number {
  const placements: { natural: string; assigned: string }[] = [];
  for (const slot of state.slots) {
    if (!slot.selectedPlayerId) continue;
    const p = getPlayer(catalog, slot.selectedPlayerId);
    placements.push({
      natural: p.naturalPosition,
      assigned: slot.position,
    });
  }
  if (placements.length !== state.slots.length) {
    // Partial lineup: chemistry from filled slots only (live meter while building).
    return placements.length === 0 ? 0 : chemistryPercent(placements);
  }
  return chemistryPercent(placements);
}

/** Whether every slot has a selected player. */
export function isLineupComplete(state: BuildState): boolean {
  return state.slots.every((s) => s.selectedPlayerId !== undefined);
}

/** Convert Build state to engine `LineupSlot[]`. */
export function buildStateToLineup(
  catalog: SquadCatalog,
  state: BuildState,
): LineupSlot[] {
  return state.slots.map((slot) => {
    if (!slot.selectedPlayerId) {
      throw new Error(`slot ${slot.slotId} has no selected player`);
    }
    const p = getPlayer(catalog, slot.selectedPlayerId);
    return {
      playerId: p.id,
      number: p.shirtNumber ?? Number(slot.slotId) + 1,
      position: slot.position,
      naturalPosition: p.naturalPosition,
      anchor: slot.anchor,
    };
  });
}

/** Validate a lineup against a scenario. */
export function validateLineup(
  catalog: SquadCatalog,
  scenarioId: string,
  lineup: LineupSlot[],
): LineupValidationResult {
  const errors: LineupValidationError[] = [];
  const scenario = getScenario(catalog, scenarioId);
  const seen = new Set<string>();

  if (lineup.length !== 11) {
    errors.push({
      code: "incomplete",
      message: `expected 11 slots, got ${lineup.length}`,
    });
  }

  for (const slot of lineup) {
    const p = catalog.players[slot.playerId];
    if (!p) {
      errors.push({
        code: "unknown_player",
        message: `unknown player ${slot.playerId}`,
        playerId: slot.playerId,
      });
      continue;
    }
    if (p.team !== scenario.team || p.cup !== scenario.cup) {
      errors.push({
        code: "wrong_scenario",
        message: `${slot.playerId} not eligible for ${scenario.team} ${scenario.cup}`,
        playerId: slot.playerId,
      });
    }
    if (!scenario.playerIds.includes(slot.playerId)) {
      errors.push({
        code: "wrong_scenario",
        message: `${slot.playerId} not in scenario squad`,
        playerId: slot.playerId,
      });
    }
    if (seen.has(slot.playerId)) {
      errors.push({
        code: "duplicate_player",
        message: `duplicate player ${slot.playerId}`,
        playerId: slot.playerId,
      });
    }
    seen.add(slot.playerId);
  }

  return { ok: errors.length === 0, errors };
}

/** Auto-fill empty slots with best-fit eligible players (deterministic). */
export function autoFillLineup(
  catalog: SquadCatalog,
  state: BuildState,
): BuildState {
  let next = state;
  for (const slot of next.slots) {
    if (slot.selectedPlayerId) continue;
    const candidates = rollSlotCandidates(catalog, next, slot.slotId);
    if (candidates.length === 0) {
      throw new Error(`no candidates to autofill slot ${slot.slotId}`);
    }
    // Pick best position fit among current batch.
    const best = [...candidates].sort(
      (a, b) =>
        roleFitScore(b.naturalPosition, slot.position) -
        roleFitScore(a.naturalPosition, slot.position),
    )[0]!;
    next = selectPlayer(catalog, next, slot.slotId, best.id);
  }
  return next;
}

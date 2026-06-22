/**
 * Deterministic roll + draft/build layer.
 *
 * Live 7a0 draft flow: each turn rolls one *(team, Cup)* scenario; the player
 * picks one squad member into a compatible XI slot. After 11 picks the draft is
 * complete. Global rerolls can refresh the current scenario (full draw or
 * year-only). All randomness derives from the server-owned seed (mulberry32).
 */

import {
  chemistryPercent,
  positionFit,
} from "./chemistry.js";
import { GLOBAL_REROLLS_PER_BUILD } from "./constants.js";
import {
  getPlayer,
  getScenario,
  scenarioPlayers,
  type PlayerCard,
  type SquadCatalog,
  type SquadScenario,
} from "./catalog.js";
import { formationAnchors, DEFAULT_FORMATION_ID } from "./formations.js";
import { canPlayInSlot, slotFitForPlayer } from "./playerPositions.js";
import { pick, rngFromSeed } from "./rng.js";
import type { LineupSlot, Side, Vec2 } from "./types.js";

/** One XI slot during Build. */
export interface BuildSlot {
  slotId: string;
  position: string;
  anchor: Vec2;
  selectedPlayerId?: string;
  /** Scenario drawn on the turn this player was picked. */
  pickedFromScenarioId?: string;
}

/** In-progress draft/build state for one side. */
export interface BuildState {
  seed: string;
  side: Side;
  /** Formation chosen before the draft (FIFA Draft-style). */
  formationId: string;
  slots: BuildSlot[];
  /** Scenario offered on the current turn (before the next pick). */
  currentScenarioId: string;
  /** Picks completed (0–11). When 11, draft is complete. */
  turnIndex: number;
  /** Global rerolls left for the whole draft. */
  globalRerollsRemaining: number;
  /** Rerolls consumed on the current turn (drives deterministic redraws). */
  rerollCounter: number;
}

export type RerollMode = "full" | "year";

export interface LineupValidationError {
  code:
    | "wrong_scenario"
    | "duplicate_player"
    | "unknown_player"
    | "incomplete"
    | "position_mismatch";
  message: string;
  playerId?: string;
}

export interface LineupValidationResult {
  ok: boolean;
  errors: LineupValidationError[];
}

function turnScenarioRng(
  seed: string,
  turnIndex: number,
  rerollCounter: number,
) {
  return rngFromSeed(`${seed}:turn:${turnIndex}:reroll:${rerollCounter}`);
}

function scenarioDrawRng(seed: string) {
  return rngFromSeed(`${seed}:draw`);
}

/** Draw one scenario from the catalog (single initial draw). */
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

function drawScenarioForTurn(
  catalog: SquadCatalog,
  seed: string,
  turnIndex: number,
  rerollCounter: number,
  excludeIds: ReadonlySet<string> = new Set(),
): SquadScenario {
  let pool = catalog.scenarios.filter((s) => !excludeIds.has(s.id));
  if (pool.length === 0) pool = [...catalog.scenarios];
  if (pool.length === 0) throw new Error("drawScenarioForTurn: empty catalog");
  const rng = turnScenarioRng(seed, turnIndex, rerollCounter);
  return pick(rng, pool);
}

function drawYearForTeam(
  catalog: SquadCatalog,
  team: string,
  seed: string,
  turnIndex: number,
  rerollCounter: number,
  excludeCup?: number,
): SquadScenario {
  let pool = catalog.scenarios.filter(
    (s) => s.team === team && s.cup !== excludeCup,
  );
  if (pool.length === 0) {
    pool = catalog.scenarios.filter((s) => s.team === team);
  }
  if (pool.length === 0) {
    throw new Error(`drawYearForTeam: no scenarios for team ${team}`);
  }
  const rng = turnScenarioRng(seed, turnIndex, rerollCounter);
  return pick(rng, pool);
}

/** Initialize draft state with empty slots and the first scenario roll. */
export function initBuildState(
  catalog: SquadCatalog,
  seed: string,
  side: Side,
  startingScenarioId?: string,
  formationId: string = DEFAULT_FORMATION_ID,
): BuildState {
  const anchors = formationAnchors(formationId);
  const slots: BuildSlot[] = anchors.map((spec, i) => {
    const x = side === "home" ? spec.anchor.x : 1 - spec.anchor.x;
    return {
      slotId: String(i),
      position: spec.position,
      anchor: { x, y: spec.anchor.y },
    };
  });
  const scenario = startingScenarioId
    ? getScenario(catalog, startingScenarioId)
    : drawScenarioForTurn(catalog, seed, 0, 0);
  return {
    seed,
    side,
    formationId,
    slots,
    currentScenarioId: scenario.id,
    turnIndex: 0,
    globalRerollsRemaining: GLOBAL_REROLLS_PER_BUILD,
    rerollCounter: 0,
  };
}

function selectedPlayerIds(state: BuildState): Set<string> {
  const ids = new Set<string>();
  for (const slot of state.slots) {
    if (slot.selectedPlayerId) ids.add(slot.selectedPlayerId);
  }
  return ids;
}

/** Whether a player can be placed in a slot. */
export function canPlaceInSlot(
  player: PlayerCard,
  slot: BuildSlot,
): boolean {
  if (slot.selectedPlayerId) return false;
  return canPlayInSlot(player, slot.position);
}

/** Open slots compatible with a player from the current squad. */
export function openSlotsForPlayer(
  catalog: SquadCatalog,
  state: BuildState,
  playerId: string,
): BuildSlot[] {
  const player = getPlayer(catalog, playerId);
  const scenario = getScenario(catalog, state.currentScenarioId);
  if (player.team !== scenario.team || player.cup !== scenario.cup) {
    return [];
  }
  if (!scenario.playerIds.includes(playerId)) return [];
  if (selectedPlayerIds(state).has(playerId)) return [];
  return state.slots.filter((s) => canPlaceInSlot(player, s));
}

/** Full current scenario squad minus already-picked players. */
export function currentSquadPlayers(
  catalog: SquadCatalog,
  state: BuildState,
): PlayerCard[] {
  const taken = selectedPlayerIds(state);
  return scenarioPlayers(catalog, state.currentScenarioId).filter(
    (p) => !taken.has(p.id),
  );
}

/**
 * Players selectable on this turn: in the current squad and with at least one
 * open compatible slot. Catalog uses a single naturalPosition per player.
 */
export function selectablePlayers(
  catalog: SquadCatalog,
  state: BuildState,
): PlayerCard[] {
  if (state.turnIndex >= state.slots.length) return [];
  return currentSquadPlayers(catalog, state).filter(
    (p) => openSlotsForPlayer(catalog, state, p.id).length > 0,
  );
}

/** Reroll the current scenario (full team+year or year-only for same team). */
export function rerollScenario(
  catalog: SquadCatalog,
  state: BuildState,
  mode: RerollMode,
): BuildState {
  if (state.turnIndex >= state.slots.length) {
    throw new Error("draft already complete");
  }
  if (state.globalRerollsRemaining <= 0) {
    throw new Error("no global rerolls remaining");
  }

  const current = getScenario(catalog, state.currentScenarioId);
  const nextRerollCounter = state.rerollCounter + 1;
  let nextScenario: SquadScenario;

  if (mode === "full") {
    nextScenario = drawScenarioForTurn(
      catalog,
      state.seed,
      state.turnIndex,
      nextRerollCounter,
      new Set([state.currentScenarioId]),
    );
  } else {
    nextScenario = drawYearForTeam(
      catalog,
      current.team,
      state.seed,
      state.turnIndex,
      nextRerollCounter,
      current.cup,
    );
  }

  return {
    ...state,
    currentScenarioId: nextScenario.id,
    rerollCounter: nextRerollCounter,
    globalRerollsRemaining: state.globalRerollsRemaining - 1,
  };
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

/** Pick a player from the current squad into a slot; auto-rolls the next scenario. */
export function selectPlayer(
  catalog: SquadCatalog,
  state: BuildState,
  slotId: string,
  playerId: string,
): BuildState {
  if (state.turnIndex >= state.slots.length) {
    throw new Error("draft already complete");
  }

  const slot = state.slots.find((s) => s.slotId === slotId);
  if (!slot) throw new Error(`unknown slot: ${slotId}`);
  if (slot.selectedPlayerId) throw new Error(`slot ${slotId} already filled`);

  const player = getPlayer(catalog, playerId);
  const scenario = getScenario(catalog, state.currentScenarioId);
  if (player.team !== scenario.team || player.cup !== scenario.cup) {
    throw new Error(`player ${playerId} not eligible for current scenario`);
  }
  if (!scenario.playerIds.includes(playerId)) {
    throw new Error(`player ${playerId} not in current scenario squad`);
  }

  const taken = selectedPlayerIds(state);
  if (taken.has(playerId)) {
    throw new Error(`player ${playerId} already selected`);
  }

  if (!canPlaceInSlot(player, slot)) {
    throw new Error(
      `player ${playerId} cannot play ${slot.position} (natural ${player.naturalPosition})`,
    );
  }

  const nextTurn = state.turnIndex + 1;
  let next: BuildState = {
    ...updateSlot(state, slotId, {
      selectedPlayerId: playerId,
      pickedFromScenarioId: state.currentScenarioId,
    }),
    turnIndex: nextTurn,
    rerollCounter: 0,
  };

  if (nextTurn >= state.slots.length) return next;

  const nextScenario = drawScenarioForTurn(
    catalog,
    state.seed,
    nextTurn,
    0,
  );
  return { ...next, currentScenarioId: nextScenario.id };
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

/** Validate a completed build state (multi-scenario XI). */
export function validateBuildState(
  catalog: SquadCatalog,
  state: BuildState,
): LineupValidationResult {
  const errors: LineupValidationError[] = [];
  const seen = new Set<string>();

  const filled = state.slots.filter((s) => s.selectedPlayerId);
  if (filled.length !== state.slots.length) {
    errors.push({
      code: "incomplete",
      message: `expected 11 slots, got ${filled.length}`,
    });
  }

  for (const slot of state.slots) {
    if (!slot.selectedPlayerId) continue;
    const p = catalog.players[slot.selectedPlayerId];
    if (!p) {
      errors.push({
        code: "unknown_player",
        message: `unknown player ${slot.selectedPlayerId}`,
        playerId: slot.selectedPlayerId,
      });
      continue;
    }
    if (slot.pickedFromScenarioId) {
      const scenario = getScenario(catalog, slot.pickedFromScenarioId);
      if (p.team !== scenario.team || p.cup !== scenario.cup) {
        errors.push({
          code: "wrong_scenario",
          message: `${slot.selectedPlayerId} not eligible for ${scenario.team} ${scenario.cup}`,
          playerId: slot.selectedPlayerId,
        });
      }
      if (!scenario.playerIds.includes(slot.selectedPlayerId)) {
        errors.push({
          code: "wrong_scenario",
          message: `${slot.selectedPlayerId} not in scenario ${scenario.id}`,
          playerId: slot.selectedPlayerId,
        });
      }
    }
    if (!canPlayInSlot(p, slot.position)) {
      errors.push({
        code: "position_mismatch",
        message: `${slot.selectedPlayerId} cannot play ${slot.position}`,
        playerId: slot.selectedPlayerId,
      });
    }
    if (seen.has(slot.selectedPlayerId)) {
      errors.push({
        code: "duplicate_player",
        message: `duplicate player ${slot.selectedPlayerId}`,
        playerId: slot.selectedPlayerId,
      });
    }
    seen.add(slot.selectedPlayerId);
  }

  return { ok: errors.length === 0, errors };
}

/** Validate a lineup against a single scenario (legacy CPU / tests). */
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

/** Auto-fill remaining picks using the draft flow (deterministic). */
export function autoFillLineup(
  catalog: SquadCatalog,
  state: BuildState,
): BuildState {
  let next = state;
  while (!isLineupComplete(next)) {
    const pool = selectablePlayers(catalog, next);
    if (pool.length === 0) {
      throw new Error(
        `no selectable players on turn ${next.turnIndex} (scenario ${next.currentScenarioId})`,
      );
    }
    const best = [...pool].sort((a, b) => {
      const slotsA = openSlotsForPlayer(catalog, next, a.id);
      const slotsB = openSlotsForPlayer(catalog, next, b.id);
      const fitA = Math.max(
        ...slotsA.map((s) => slotFitForPlayer(a, s.position)),
      );
      const fitB = Math.max(
        ...slotsB.map((s) => slotFitForPlayer(b, s.position)),
      );
      if (fitB !== fitA) return fitB - fitA;
      return a.name.localeCompare(b.name);
    })[0]!;
    const targetSlot = openSlotsForPlayer(catalog, next, best.id).sort(
      (a, b) =>
        slotFitForPlayer(best, b.position) - slotFitForPlayer(best, a.position),
    )[0]!;
    next = selectPlayer(catalog, next, targetSlot.slotId, best.id);
  }
  return next;
}

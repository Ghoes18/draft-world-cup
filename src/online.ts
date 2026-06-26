/**
 * Server-authoritative online duel helpers (MVP M4 / PRD §9).
 *
 * The draft (`./roll.js`) is a pure, seed-deterministic state machine, so we
 * achieve server authority by *replaying* a client-submitted action log from
 * the server-owned seed rather than trusting any client-sent lineup. Every
 * scenario roll, reroll-limit and eligibility check falls out of the replay
 * (`replayBuild`) plus `validateBuildState`. The duel result is then computed
 * once, head-to-head, by `resolveDuel`.
 *
 * Both functions are pure and deterministic in the seed, so they run unchanged
 * inside a Convex action (the canonical server runtime for online + daily).
 */

import type { SquadCatalog } from "./catalog.js";
import { getScenario } from "./catalog.js";
import type { Tactic } from "./constants.js";
import { simulateMatch, type MatchResult } from "./engine.js";
import { effectiveStrength } from "./strength.js";
import { generateTimeline } from "./timeline/generate.js";
import { buildStateToTeamStrength } from "./lineupStrength.js";
import { buildStateSynergy } from "./synergy.js";
import {
  autoFillLineup,
  buildStateToLineup,
  initBuildState,
  isLineupComplete,
  rerollScenario,
  selectPlayer,
  validateBuildState,
  type BuildState,
  type RerollMode,
} from "./roll.js";
import type { MatchScenario, MatchTimeline, Side } from "./types.js";

/** One recorded Build action, in the order the player performed it. */
export type BuildAction =
  | { type: "reroll"; mode: RerollMode }
  | { type: "pick"; slotId: string; playerId: string };

/** A client's full Build submission for one seat. */
export interface BuildSubmission {
  seed: string;
  side: Side;
  formationId: string;
  actions: BuildAction[];
  tactic: Tactic;
}

/**
 * Reconstruct the authoritative `BuildState` for one seat by folding the
 * action log through the pure draft functions from the server-owned seed.
 *
 * Throws (via the underlying `selectPlayer`/`rerollScenario`) on any illegal
 * action — ineligible player, filled slot, exhausted rerolls — which is exactly
 * the anti-cheat guarantee we want (PRD §9.7). Callers run inside a try/catch.
 */
export function replayBuild(
  catalog: SquadCatalog,
  submission: Pick<BuildSubmission, "seed" | "side" | "formationId" | "actions">,
): BuildState {
  let state = initBuildState(
    catalog,
    submission.seed,
    submission.side,
    undefined,
    submission.formationId,
  );
  for (const action of submission.actions) {
    if (action.type === "reroll") {
      state = rerollScenario(catalog, state, action.mode);
    } else {
      state = selectPlayer(catalog, state, action.slotId, action.playerId);
    }
  }
  return state;
}

/** A seat resolved to its authoritative Build state + chosen tactic. */
export interface ResolvedSide {
  buildState: BuildState;
  tactic: Tactic;
}

export interface DuelResolution {
  result: MatchResult;
  timeline: MatchTimeline;
  /** Final (post auto-fill) Build states actually fed to the engine. */
  finalStates: Record<Side, BuildState>;
}

/** Label a side by the scenario its first pick came from (mirrors solo Build). */
function scenarioLabel(catalog: SquadCatalog, state: BuildState): MatchScenario {
  const firstPick = state.slots.find((s) => s.pickedFromScenarioId);
  const id = firstPick?.pickedFromScenarioId ?? state.currentScenarioId;
  const scenario = getScenario(catalog, id);
  return { team: scenario.team, cup: scenario.cup };
}

/**
 * Resolve a head-to-head duel from two authoritative Build states.
 *
 * Incomplete XIs are filled deterministically (`autoFillLineup`, MVP §9.3),
 * tactic feeds `effectiveStrength`, then a single knockout match
 * (tie → penalties, MVP §9.1–9.2) produces the canonical timeline. Pure and
 * deterministic in `seed`, so both clients can present the identical result.
 */
export function resolveDuel(
  catalog: SquadCatalog,
  input: {
    seed: string;
    home: ResolvedSide;
    away: ResolvedSide;
    /** Tie → penalties (default, matches 1v1 duel behavior). `false` allows a draw — group-stage fixtures. */
    knockout?: boolean;
  },
): DuelResolution {
  const fill = (s: BuildState): BuildState =>
    isLineupComplete(s) ? s : autoFillLineup(catalog, s);

  const homeState = fill(input.home.buildState);
  const awayState = fill(input.away.buildState);

  const homeSynergy = buildStateSynergy(catalog, homeState);
  const awaySynergy = buildStateSynergy(catalog, awayState);

  const result = simulateMatch({
    home: effectiveStrength(buildStateToTeamStrength(catalog, homeState), {
      tactic: input.home.tactic,
      chemistryBonus: homeSynergy.chemistryBonus,
      legendBonus: homeSynergy.legendBonus,
    }),
    away: effectiveStrength(buildStateToTeamStrength(catalog, awayState), {
      tactic: input.away.tactic,
      chemistryBonus: awaySynergy.chemistryBonus,
      legendBonus: awaySynergy.legendBonus,
    }),
    seed: input.seed,
    knockout: input.knockout ?? true,
  });

  const timeline = generateTimeline({
    result,
    seed: input.seed,
    scenario: scenarioLabel(catalog, homeState),
    lineups: {
      home: buildStateToLineup(catalog, homeState),
      away: buildStateToLineup(catalog, awayState),
    },
  });

  return {
    result,
    timeline,
    finalStates: { home: homeState, away: awayState },
  };
}

/**
 * Replay + validate a submission, returning the authoritative state or the
 * validation errors. Convex mutations use this to reject tampered logs before
 * persisting. A throw during replay is reported as a single `replay_error`.
 */
export function replayAndValidate(
  catalog: SquadCatalog,
  submission: BuildSubmission,
):
  | { ok: true; state: BuildState }
  | { ok: false; errors: { code: string; message: string }[] } {
  let state: BuildState;
  try {
    state = replayBuild(catalog, submission);
  } catch (err) {
    return {
      ok: false,
      errors: [
        {
          code: "replay_error",
          message: err instanceof Error ? err.message : String(err),
        },
      ],
    };
  }
  // A partial (timed-out) log is allowed — it is auto-filled at resolution.
  // Only validate the slots actually filled so far.
  const validation = validateBuildState(catalog, state);
  const hard = validation.errors.filter((e) => e.code !== "incomplete");
  if (hard.length > 0) {
    return { ok: false, errors: hard };
  }
  return { ok: true, state };
}

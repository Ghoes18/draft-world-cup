"use client";

/**
 * BuildPanel — two-column build screen (breakdown §/play):
 * left = roll/pick panel, right = formation pitch.
 */

import { useState } from "react";
import {
  buildChemistryPercent,
  buildStateToTeamStrength,
  currentSquadPlayers,
  effectiveStrength,
  expectedGoals,
  formatPlacementOptions,
  formatPlayerPositions,
  getFormation,
  getScenario,
  isLineupComplete,
  openSlotsForPlayer,
  partialBuildToTeamStrength,
  playerOverall,
  rerollScenario,
  selectPlayer,
  selectablePlayers,
  type BuildState,
  type PlayerCard,
  type SquadCatalog,
  type Tactic,
  type TeamStrength,
} from "7a0-engine";
import { Pitch } from "./Pitch";
import { STRINGS as S } from "../_data/strings";

const TACTICS: readonly Tactic[] = ["offensive", "balanced", "defensive"];

export function BuildPanel({
  catalog,
  awayStrength,
  buildState,
  onBuildState,
  tactic,
  onTactic,
}: {
  catalog: SquadCatalog;
  awayStrength: TeamStrength;
  buildState: BuildState;
  onBuildState: (s: BuildState) => void;
  tactic: Tactic;
  onTactic: (t: Tactic) => void;
}) {
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null);
  const [highlightSlotId, setHighlightSlotId] = useState<string | undefined>();

  const chem = Math.round(buildChemistryPercent(catalog, buildState));
  const complete = isLineupComplete(buildState);
  const homeBase = complete
    ? buildStateToTeamStrength(catalog, buildState)
    : partialBuildToTeamStrength(catalog, buildState);
  const homeEff = homeBase
    ? effectiveStrength(homeBase, { chemistryPct: chem, tactic })
    : null;
  const lambdaHome =
    homeEff != null
      ? expectedGoals(homeEff.attack, awayStrength.defense)
      : null;
  const lambdaAway =
    homeEff != null
      ? expectedGoals(awayStrength.attack, homeEff.defense)
      : null;

  const currentScenario = getScenario(catalog, buildState.currentScenarioId);
  const formationLabel = getFormation(buildState.formationId).label;
  const scenarioLabel = `${currentScenario.team} · ${currentScenario.cup}`;
  const pool = complete ? [] : selectablePlayers(catalog, buildState);
  const squadSize = currentSquadPlayers(catalog, buildState).length;
  const rerollsLeft = buildState.globalRerollsRemaining;
  const turnLabel = `${buildState.turnIndex + 1} / 11`;
  const chemClamped = Math.max(0, Math.min(100, chem));

  const pendingPlayer = pendingPlayerId
    ? pool.find((p) => p.id === pendingPlayerId) ?? null
    : null;
  const pendingSlots = pendingPlayer
    ? openSlotsForPlayer(catalog, buildState, pendingPlayer.id)
    : [];

  function onSelect(slotId: string, playerId: string) {
    try {
      onBuildState(selectPlayer(catalog, buildState, slotId, playerId));
      setPendingPlayerId(null);
      setHighlightSlotId(undefined);
    } catch {
      // Invalid selection — ignore in demo UI.
    }
  }

  function onReroll(mode: "full" | "year") {
    try {
      onBuildState(rerollScenario(catalog, buildState, mode));
      setPendingPlayerId(null);
      setHighlightSlotId(undefined);
    } catch {
      // Limit reached — ignore in demo UI.
    }
  }

  function onPickPlayer(playerId: string) {
    setPendingPlayerId((cur) => (cur === playerId ? null : playerId));
    setHighlightSlotId(undefined);
  }

  function onSlotPick(slotId: string) {
    if (pendingPlayerId) {
      const allowed = openSlotsForPlayer(catalog, buildState, pendingPlayerId);
      if (allowed.some((s) => s.slotId === slotId)) {
        onSelect(slotId, pendingPlayerId);
        return;
      }
    }
    setHighlightSlotId(slotId);
  }

  return (
    <section className="build">
      <div className="build__head">
        <div>
          <div className="eyebrow">{S.build.kicker}</div>
          <h2 className="panel__title">{S.build.heading}</h2>
          <p className="dim" style={{ marginTop: "0.35rem", fontSize: "0.82rem" }}>
            {formationLabel}
          </p>
        </div>
        {complete && (
          <p className="build__complete mono" role="status">
            {S.build.lineupComplete}
          </p>
        )}
      </div>

      <div className="build__grid">
        <div className="build__roll panel">
          {!complete && (
            <div className="well">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="label">{S.build.currentRoll}</div>
                  <strong className="draw-display">{scenarioLabel}</strong>
                </div>
                <span className="mono dim">{S.build.turn(turnLabel)}</span>
              </div>
              <div className="label" style={{ margin: "0.6rem 0" }}>
                {S.build.squadSize(squadSize)} · {S.build.rerollsLeft(rerollsLeft)}
              </div>
              <div className="row">
                <button
                  disabled={rerollsLeft <= 0}
                  onClick={() => onReroll("full")}
                >
                  {S.build.rerollSelection}
                </button>
                <button
                  disabled={rerollsLeft <= 0}
                  onClick={() => onReroll("year")}
                >
                  {S.build.rerollYear}
                </button>
              </div>
            </div>
          )}

          <div className="stack" style={{ marginTop: "1rem" }}>
            <div className="label">{S.build.tactic}</div>
            <div className="seg">
              {TACTICS.map((t) => (
                <button
                  key={t}
                  aria-pressed={tactic === t}
                  onClick={() => onTactic(t)}
                >
                  {S.build[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="stack" style={{ marginTop: "1rem" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="label">{S.build.chemistry}</span>
              <span className="mono">
                <strong>{chem}%</strong>
                {complete ? "" : ` · ${S.build.incomplete}`}
              </span>
            </div>
            <div
              className="meter"
              role="meter"
              aria-valuenow={chemClamped}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={S.build.chemistry}
            >
              <div className="meter__fill" style={{ width: `${chemClamped}%` }} />
            </div>
            {homeBase && homeEff && (
              <div className="row" style={{ gap: "1.1rem" }}>
                <Stat label={S.build.atk} base={homeBase.attack} eff={homeEff.attack} />
                <Stat label={S.build.def} base={homeBase.defense} eff={homeEff.defense} />
                <Stat label={S.build.ovr} base={homeBase.overall} eff={homeEff.overall} />
              </div>
            )}
          </div>

          {!complete && pool.length > 0 && (
            <div style={{ marginTop: "1.25rem" }}>
              <div className="label" style={{ marginBottom: "0.5rem" }}>
                {pendingPlayer ? S.build.pickSlot : S.build.pickPlayer}
              </div>
              <div className="stack">
                {pool.map((p) => (
                  <PlayerPickRow
                    key={p.id}
                    player={p}
                    selected={pendingPlayerId === p.id}
                    onSelect={() => onPickPlayer(p.id)}
                    onPlace={(slotId) => onSelect(slotId, p.id)}
                    slots={openSlotsForPlayer(catalog, buildState, p.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {homeEff && lambdaHome != null && lambdaAway != null && (
            <div className="well" style={{ marginTop: "1.25rem" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="label">{S.build.lambda}</span>
                <span className="mono">
                  <strong>{lambdaHome.toFixed(2)}</strong> {S.vs}{" "}
                  <strong>{lambdaAway.toFixed(2)}</strong>
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="build__pitch panel panel--pitch">
          <div className="label" style={{ marginBottom: "0.75rem" }}>
            {S.build.pitch}
          </div>
          <Pitch
            catalog={catalog}
            buildState={buildState}
            compatibleSlotIds={
              pendingPlayer ? pendingSlots.map((s) => s.slotId) : undefined
            }
            highlightSlotId={highlightSlotId}
            onSlotPick={!complete ? onSlotPick : undefined}
          />
          {pendingPlayer && pendingSlots.length > 0 && (
            <p className="dim" style={{ fontSize: "0.82rem", marginTop: "0.75rem" }}>
              {S.build.hintPlace}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  base,
  eff,
}: {
  label: string;
  base: number;
  eff: number;
}) {
  const delta = eff - base;
  const sign = delta > 0 ? "+" : "";
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="stat__num">
        {eff}
        {delta !== 0 && (
          <span className={`stat__delta ${delta > 0 ? "up" : "down"}`}>
            {sign}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

function PlayerPickRow({
  player,
  selected,
  onSelect,
  onPlace,
  slots,
}: {
  player: PlayerCard;
  selected: boolean;
  onSelect: () => void;
  onPlace: (slotId: string) => void;
  slots: { slotId: string; position: string }[];
}) {
  const positions =
    selected && slots.length > 0
      ? formatPlacementOptions(slots)
      : formatPlayerPositions(player);

  return (
    <div className={`chip${selected ? " chip--selected" : ""}`}>
      <button
        type="button"
        className="chip__main"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className="rating">{playerOverall(player)}</span>
        <span className="chip__body">
          <strong>{player.name}</strong>
          <span className="chip__positions mono dim">{positions}</span>
        </span>
      </button>
      {selected && slots.length > 0 && (
        <div className="row" style={{ gap: "0.35rem" }}>
          {slots.map((s) => (
            <button key={s.slotId} type="button" onClick={() => onPlace(s.slotId)}>
              {S.build.placeIn(s.position)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

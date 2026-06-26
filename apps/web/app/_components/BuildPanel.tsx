"use client";

/**
 * BuildPanel — draft HUD + squad pool (left) and live formation pitch (right).
 */

import { useMemo, useState } from "react";
import {
  buildStateSynergy,
  buildStateToTeamStrength,
  currentSquadPlayers,
  effectiveStrength,
  expectedGoals,
  formatPlacementOptions,
  formatEligibleFormationSlots,
  getFormation,
  getScenario,
  isLegendPlayer,
  isLineupComplete,
  isPlayerPickable,
  openSlotsForPlayer,
  partialBuildToTeamStrength,
  pickablePlayersForSlot,
  playerOverall,
  rerollScenario,
  selectPlayer,
  type BuildAction,
  type BuildState,
  type PlayerCard,
  type SquadCatalog,
  type SquadScenario,
  type TeamStrength,
} from "7a0-engine";
import { useCasinoRoulette } from "../_hooks/useCasinoRoulette";
import { Pitch } from "./Pitch";
import { PlayerAvatar } from "./PlayerAvatar";
import { STRINGS as S } from "../_data/strings";
import { formatScenarioLabel } from "../_data/teamDisplay";

function scenarioId(s: SquadScenario): string {
  return s.id;
}

const BUILD_TACTIC = "balanced" as const;

export function BuildPanel({
  catalog,
  awayStrength,
  buildState,
  onBuildState,
  onAction,
}: {
  catalog: SquadCatalog;
  awayStrength: TeamStrength;
  buildState: BuildState;
  onBuildState: (s: BuildState) => void;
  /** Optional: records each draft action (online duel server-replay log). */
  onAction?: (action: BuildAction) => void;
}) {
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  const complete = isLineupComplete(buildState);
  const homeBase = complete
    ? buildStateToTeamStrength(catalog, buildState)
    : partialBuildToTeamStrength(catalog, buildState);
  const synergy = useMemo(
    () => buildStateSynergy(catalog, buildState),
    [catalog, buildState],
  );
  const homeEff = homeBase
    ? effectiveStrength(homeBase, {
        tactic: BUILD_TACTIC,
        chemistryBonus: synergy.chemistryBonus,
        legendBonus: synergy.legendBonus,
      })
    : null;
  const lambdaHome =
    homeEff != null
      ? expectedGoals(
          homeEff.attack,
          awayStrength.defense,
          homeEff.midfield,
          awayStrength.midfield,
        )
      : null;
  const lambdaAway =
    homeEff != null
      ? expectedGoals(
          awayStrength.attack,
          homeEff.defense,
          awayStrength.midfield,
          homeEff.midfield,
        )
      : null;

  const currentScenario = getScenario(catalog, buildState.currentScenarioId);
  const formationLabel = getFormation(buildState.formationId).label;
  const formationSlots = getFormation(buildState.formationId).slots;
  const scenarioSpinKey = `${buildState.turnIndex}:${buildState.rerollCounter}:${buildState.currentScenarioId}`;
  const scenarioPool = useMemo(() => catalog.scenarios, [catalog.scenarios]);

  const { display: displayScenario, spinning: scenarioSpinning } = useCasinoRoulette({
    pool: scenarioPool,
    target: currentScenario,
    spinKey: scenarioSpinKey,
    getId: scenarioId,
    durationMs: 2200,
  });

  const displayBuildState = useMemo(() => ({
    ...buildState,
    currentScenarioId: displayScenario.id
  }), [buildState, displayScenario.id]);

  const squadPool = complete ? [] : currentSquadPlayers(catalog, displayBuildState);
  const squadSize = currentSquadPlayers(catalog, buildState).length;
  const rerollsLeft = buildState.globalRerollsRemaining;
  const turnIndex = buildState.turnIndex;
  const filledSlots = buildState.slots.filter((s) => s.selectedPlayerId).length;

  const pendingPlayer = pendingPlayerId
    ? (squadPool.find((p) => p.id === pendingPlayerId) ?? null)
    : null;
  const pendingPickable =
    pendingPlayer != null &&
    isPlayerPickable(catalog, buildState, pendingPlayer.id);
  const pendingSlots = pendingPickable && pendingPlayer
    ? openSlotsForPlayer(catalog, buildState, pendingPlayer.id)
    : [];

  const activeSlotPlayers = useMemo(() => {
    if (!activeSlotId) return [];
    return pickablePlayersForSlot(catalog, buildState, activeSlotId).sort(
      (a, b) => playerOverall(b) - playerOverall(a),
    );
  }, [activeSlotId, buildState, catalog]);

  function onSelect(slotId: string, playerId: string) {
    try {
      onBuildState(selectPlayer(catalog, buildState, slotId, playerId));
      onAction?.({ type: "pick", slotId, playerId });
      setPendingPlayerId(null);
      setActiveSlotId(null);
    } catch {
      // Invalid selection — ignore in demo UI.
    }
  }

  function onReroll(mode: "full" | "year") {
    try {
      onBuildState(rerollScenario(catalog, buildState, mode));
      onAction?.({ type: "reroll", mode });
      setPendingPlayerId(null);
      setActiveSlotId(null);
    } catch {
      // Limit reached — ignore in demo UI.
    }
  }

  function onPickPlayer(playerId: string) {
    if (!isPlayerPickable(catalog, buildState, playerId)) return;
    setPendingPlayerId((cur) => (cur === playerId ? null : playerId));
    setActiveSlotId(null);
  }

  function onSlotPick(slotId: string) {
    if (pendingPlayerId) {
      const allowed = openSlotsForPlayer(catalog, buildState, pendingPlayerId);
      if (allowed.some((s) => s.slotId === slotId)) {
        onSelect(slotId, pendingPlayerId);
        return;
      }
      return;
    }
    const slot = buildState.slots.find((s) => s.slotId === slotId);
    if (slot && !slot.selectedPlayerId) {
      setActiveSlotId((cur) => (cur === slotId ? null : slotId));
    }
  }

  function onPickFromSlot(slotId: string, playerId: string) {
    onSelect(slotId, playerId);
  }

  return (
    <section className="build">
      <div className="build__head">
        <div>
          <div className="eyebrow">{S.build.kicker}</div>
          <h2 className="panel__title">{S.build.heading}</h2>
          <p className="build__formation dim">{formationLabel}</p>
        </div>
        {complete && (
          <p className="build__complete mono" role="status">
            {S.build.lineupComplete}
          </p>
        )}
      </div>

      <div className="build__grid">
        <aside className="build__controls panel">
          {!complete && (
            <>
              <DraftProgress turnIndex={turnIndex} filledSlots={filledSlots} />

              <div className={`draft-roll${scenarioSpinning ? " draft-roll--spinning" : ""}`}>
                <div className="draft-roll__meta">
                  <span className="label">{S.build.currentRoll}</span>
                  <span className="draft-roll__turn mono">
                    {S.build.turn(`${turnIndex + 1} / 11`)}
                  </span>
                </div>
                <div className="draft-roll__team">
                  <span className="draft-roll__team-line">
                    {formatScenarioLabel(displayScenario.team, displayScenario.cup)}
                  </span>
                </div>
                <div className="draft-roll__facts mono dim">
                  <span>{S.build.squadSize(squadSize)}</span>
                  <span className="draft-roll__dot" aria-hidden>
                    ·
                  </span>
                  <span
                    className={
                      rerollsLeft <= 1 ? "draft-roll__rerolls--low" : undefined
                    }
                  >
                    {S.build.rerollsLeft(rerollsLeft)}
                  </span>
                </div>
                <div className="draft-roll__actions">
                  <button
                    type="button"
                    className="draft-roll__btn"
                    disabled={rerollsLeft <= 0 || scenarioSpinning}
                    onClick={() => onReroll("full")}
                  >
                    {S.build.rerollSelection}
                  </button>
                  <button
                    type="button"
                    className="draft-roll__btn"
                    disabled={rerollsLeft <= 0 || scenarioSpinning}
                    onClick={() => onReroll("year")}
                  >
                    {S.build.rerollYear}
                  </button>
                </div>
                <p className="draft-roll__hint dim">{S.build.rerollHint}</p>
              </div>
            </>
          )}

          <div className="build__meta">
            {homeBase && homeEff && (
              <div className="team-sheet" aria-label={S.build.effective}>
                <div className="team-sheet__head">
                  <span className="label">{S.build.effective}</span>
                </div>
                <div className="team-sheet__body">
                  <div className="team-sheet__zones" role="group">
                    <TeamStat
                      label={S.build.atk}
                      base={homeBase.attack}
                      eff={homeEff.attack}
                      zone="atk"
                    />
                    <TeamStat
                      label={S.build.mid}
                      base={homeBase.midfield}
                      eff={homeEff.midfield}
                      zone="mid"
                    />
                    <TeamStat
                      label={S.build.def}
                      base={homeBase.defense}
                      eff={homeEff.defense}
                      zone="def"
                    />
                  </div>
                  <div className="team-sheet__ovr">
                    <TeamStat
                      label={S.build.ovr}
                      base={homeBase.overall}
                      eff={homeEff.overall}
                      zone="ovr"
                      highlight
                    />
                  </div>
                </div>
                <div className="team-sheet__footer" aria-label={S.build.synergy}>
                  <div className="team-sheet__badge team-sheet__badge--chem">
                    <span className="label">{S.build.chemistry}</span>
                    <span
                      className="team-sheet__chem-track"
                      role="presentation"
                      aria-hidden
                    >
                      <span
                        className="team-sheet__chem-fill"
                        style={{
                          width: `${Math.round(synergy.chemistryPercent)}%`,
                        }}
                      />
                    </span>
                    <span className="team-sheet__badge-val mono">
                      {Math.round(synergy.chemistryPercent)}%
                      {synergy.chemistryBonus > 0 && (
                        <span className="team-sheet__delta up">
                          +{synergy.chemistryBonus}
                        </span>
                      )}
                    </span>
                  </div>
                  <div
                    className={[
                      "team-sheet__badge",
                      synergy.legendCount > 0
                        ? "team-sheet__badge--legends"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="label">{S.build.legends}</span>
                    <span className="team-sheet__badge-val mono">
                      {synergy.legendCount}
                      {synergy.legendBonus > 0 && (
                        <span className="team-sheet__delta up">
                          +{synergy.legendBonus}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!complete && squadPool.length > 0 && (
            <div className={`draft-pool${scenarioSpinning ? " draft-pool--spinning" : ""}`}>
              <div className="draft-pool__head">
                <span className="label">
                  {pendingPickable && pendingPlayer
                    ? S.build.stepPlace
                    : S.build.stepPick}
                </span>
                <span className="label draft-pool__count">
                  {S.build.squadPool} · {squadPool.length}
                </span>
              </div>
              <p className="draft-pool__ovr-note dim">
                {S.build.ovrNote(displayScenario.cup)}
              </p>
              {pendingPickable && pendingPlayer && (
                <p className="draft-pool__hint" role="status">
                  {S.build.hintPlace}
                </p>
              )}
              <ul className="draft-pool__list">
                {squadPool.map((p) => {
                  const slots = openSlotsForPlayer(catalog, buildState, p.id);
                  const pickable = slots.length > 0;
                  return (
                    <PlayerPickRow
                      key={p.id}
                      player={p}
                      pickable={pickable}
                      selected={pickable && pendingPlayerId === p.id}
                      onSelect={() => onPickPlayer(p.id)}
                      onPlace={(slotId) => onSelect(slotId, p.id)}
                      slots={slots}
                      formationSlots={formationSlots}
                    />
                  );
                })}
              </ul>
            </div>
          )}

          {homeEff && lambdaHome != null && lambdaAway != null && (
            <div className="draft-xg well">
              <span className="label">{S.build.lambda}</span>
              <span className="mono draft-xg__vals">
                <strong>{lambdaHome.toFixed(2)}</strong>
                <span className="dim"> {S.vs} </span>
                <strong>{lambdaAway.toFixed(2)}</strong>
              </span>
            </div>
          )}
        </aside>

        <div className="build__pitch-wrap">
          <div className="build__pitch panel panel--pitch">
            <div className="build__pitch-head">
              <span className="label">{S.build.pitch}</span>
              {pendingPickable && pendingPlayer && (
                <span className="build__pitch-pending">
                  <PlayerAvatar player={pendingPlayer} size="sm" selected />
                  <span className="mono">{pendingPlayer.name}</span>
                </span>
              )}
            </div>
            <Pitch
              catalog={catalog}
              buildState={buildState}
              compatibleSlotIds={
                pendingPickable && pendingPlayer
                  ? pendingSlots.map((s) => s.slotId)
                  : undefined
              }
              activeSlotId={activeSlotId ?? undefined}
              playersForActiveSlot={activeSlotPlayers}
              onSlotPick={!complete ? onSlotPick : undefined}
              onPickFromSlot={!complete ? onPickFromSlot : undefined}
              onCloseSlotPopover={() => setActiveSlotId(null)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function DraftProgress({
  turnIndex,
  filledSlots,
}: {
  turnIndex: number;
  filledSlots: number;
}) {
  return (
    <div className="draft-progress" aria-label={S.build.draftInProgress(turnIndex + 1)}>
      <div className="draft-progress__track">
        {Array.from({ length: 11 }, (_, i) => (
          <span
            key={i}
            className={[
              "draft-progress__pip",
              i < filledSlots ? "draft-progress__pip--done" : "",
              i === filledSlots && filledSlots < 11
                ? "draft-progress__pip--active"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden
          />
        ))}
      </div>
      <span className="draft-progress__label mono">
        {S.build.draftInProgress(turnIndex + 1)}
      </span>
    </div>
  );
}

function TeamStat({
  label,
  base,
  eff,
  zone,
  highlight = false,
}: {
  label: string;
  base: number;
  eff: number;
  zone: "atk" | "mid" | "def" | "ovr";
  highlight?: boolean;
}) {
  const delta = eff - base;
  const sign = delta > 0 ? "+" : "";
  return (
    <div
      className={[
        "team-sheet__stat",
        `team-sheet__stat--${zone}`,
        highlight ? "team-sheet__stat--hero" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="team-sheet__stat-label">{label}</span>
      <span className="team-sheet__stat-val mono">
        {eff}
        {delta !== 0 && (
          <span className={`team-sheet__delta ${delta > 0 ? "up" : "down"}`}>
            {sign}
            {delta}
          </span>
        )}
      </span>
    </div>
  );
}

function PlayerPickRow({
  player,
  pickable,
  selected,
  onSelect,
  onPlace,
  slots,
  formationSlots,
}: {
  player: PlayerCard;
  pickable: boolean;
  selected: boolean;
  onSelect: () => void;
  onPlace: (slotId: string) => void;
  slots: { slotId: string; position: string }[];
  formationSlots: readonly { position: string }[];
}) {
  const positions =
    slots.length > 0
      ? formatPlacementOptions(slots)
      : formatEligibleFormationSlots(player, formationSlots);
  const ovr = playerOverall(player);

  return (
    <li
      className={[
        "player-card",
        selected ? "player-card--selected" : "",
        !pickable ? "player-card--unavailable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="player-card__main"
        disabled={!pickable}
        aria-pressed={pickable ? selected : false}
        aria-disabled={!pickable}
        title={!pickable ? S.build.noOpenSlot : undefined}
        onClick={pickable ? onSelect : undefined}
      >
        <PlayerAvatar player={player} size="md" selected={selected} />
        <span
          className="player-card__ovr"
          aria-label={`${S.build.playerOvr} ${ovr} — ${S.build.ovrTooltip(player.cup)}`}
          title={S.build.ovrTooltip(player.cup)}
        >
          {ovr}
        </span>
        <span className="player-card__body">
          <strong
            className={[
              "player-card__name",
              isLegendPlayer(player.name) ? "player-name--legend" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {player.name}
          </strong>
          <span className="player-card__pos mono dim">{positions}</span>
        </span>
        <span className="player-card__chev" aria-hidden>
          {!pickable ? "—" : selected ? "−" : "+"}
        </span>
      </button>
      {selected && slots.length > 0 && (
        <div className="player-card__slots" role="group" aria-label={S.build.pickSlot}>
          {slots.map((s) => (
            <button
              key={s.slotId}
              type="button"
              className="slot-pill"
              onClick={() => onPlace(s.slotId)}
            >
              {S.build.placeIn(s.position)}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

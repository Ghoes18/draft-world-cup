"use client";

/**
 * BuildPanel — per-slot candidate rolls, selection, rerolls, tactic, and live
 * chemistry + derived attack/defense/overall from player forces.
 */

import {
  allSlotCandidates,
  buildChemistryPercent,
  buildStateToTeamStrength,
  effectiveStrength,
  expectedGoals,
  forceToRating,
  getPlayer,
  isLineupComplete,
  partialBuildToTeamStrength,
  rerollSlot,
  REROLLS_PER_SLOT,
  selectPlayer,
  type BuildState,
  type PlayerCard,
  type SquadCatalog,
  type Tactic,
  type TeamStrength,
} from "7a0-engine";
import { STRINGS as S } from "../_data/strings";

const TACTICS: readonly Tactic[] = ["offensive", "balanced", "defensive"];

export function BuildPanel({
  catalog,
  scenarioLabel,
  awayStrength,
  buildState,
  onBuildState,
  tactic,
  onTactic,
}: {
  catalog: SquadCatalog;
  scenarioLabel: string;
  awayStrength: TeamStrength;
  buildState: BuildState;
  onBuildState: (s: BuildState) => void;
  tactic: Tactic;
  onTactic: (t: Tactic) => void;
}) {
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
  const candidates = allSlotCandidates(catalog, buildState);

  function onSelect(slotId: string, playerId: string) {
    try {
      onBuildState(selectPlayer(catalog, buildState, slotId, playerId));
    } catch {
      // Invalid selection — ignore in demo UI.
    }
  }

  function onReroll(slotId: string, emergency = false) {
    try {
      onBuildState(rerollSlot(buildState, slotId, emergency));
    } catch {
      // Limit reached — ignore in demo UI.
    }
  }

  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "1rem 1.25rem",
        margin: "1rem 0",
        maxWidth: 720,
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>{S.build.heading}</h2>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>{scenarioLabel}</p>

      <div style={{ marginBottom: "0.9rem" }}>
        <div style={{ color: "var(--muted)", marginBottom: "0.35rem" }}>
          {S.build.tactic}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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

      <div style={{ marginBottom: "1rem", fontVariantNumeric: "tabular-nums" }}>
        <div style={{ color: "var(--muted)" }}>{S.build.chemistry}</div>
        <div>
          <strong>{chem}%</strong>
          {complete ? "" : ` (${S.build.incomplete})`}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {buildState.slots.map((slot) => (
          <SlotRow
            key={slot.slotId}
            catalog={catalog}
            slotId={slot.slotId}
            position={slot.position}
            selectedId={slot.selectedPlayerId}
            rerollsUsed={slot.rerollsUsed}
            emergencyUsed={slot.emergencyUsed}
            emergencyRemaining={buildState.emergencyRerollsRemaining}
            candidates={candidates[slot.slotId] ?? []}
            onSelect={onSelect}
            onReroll={onReroll}
          />
        ))}
      </div>

      {homeBase && homeEff && (
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            flexWrap: "wrap",
            fontVariantNumeric: "tabular-nums",
            fontSize: "0.9rem",
            marginTop: "1rem",
          }}
        >
          <div>
            <div style={{ color: "var(--muted)" }}>{S.build.effective}</div>
            <div>
              {S.build.atk} {homeBase.attack} → <strong>{homeEff.attack}</strong>
              {"   "}
              {S.build.def} {homeBase.defense} → <strong>{homeEff.defense}</strong>
              {"   "}
              {S.build.ovr} {homeBase.overall} → <strong>{homeEff.overall}</strong>
            </div>
          </div>
          {lambdaHome != null && lambdaAway != null && (
            <div>
              <div style={{ color: "var(--muted)" }}>{S.build.lambda}</div>
              <div>
                <strong>{lambdaHome.toFixed(2)}</strong> {S.vs}{" "}
                <strong>{lambdaAway.toFixed(2)}</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SlotRow({
  catalog,
  slotId,
  position,
  selectedId,
  rerollsUsed,
  emergencyUsed,
  emergencyRemaining,
  candidates,
  onSelect,
  onReroll,
}: {
  catalog: SquadCatalog;
  slotId: string;
  position: string;
  selectedId?: string;
  rerollsUsed: number;
  emergencyUsed: boolean;
  emergencyRemaining: number;
  candidates: PlayerCard[];
  onSelect: (slotId: string, playerId: string) => void;
  onReroll: (slotId: string, emergency?: boolean) => void;
}) {
  const rerollsLeft = REROLLS_PER_SLOT - rerollsUsed;
  const selected = selectedId ? getPlayer(catalog, selectedId) : null;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "0.6rem 0.75rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "0.4rem",
        }}
      >
        <strong>{position}</strong>
        {!selectedId && (
          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            {S.build.rerollsLeft(rerollsLeft)}
          </span>
        )}
      </div>

      {selected ? (
        <div style={{ fontSize: "0.9rem" }}>
          {S.build.selected}: <strong>{selected.name}</strong> ·{" "}
          {S.build.force} {forceToRating(selected.force)}
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              gap: "0.4rem",
              flexWrap: "wrap",
              marginBottom: "0.4rem",
            }}
          >
            {candidates.map((c) => (
              <button key={c.id} onClick={() => onSelect(slotId, c.id)}>
                {c.name} ({c.naturalPosition}) · {forceToRating(c.force)}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <button
              disabled={rerollsLeft <= 0}
              onClick={() => onReroll(slotId, false)}
            >
              {S.build.reroll}
            </button>
            <button
              disabled={emergencyRemaining <= 0 || emergencyUsed}
              onClick={() => onReroll(slotId, true)}
            >
              {S.build.emergencyReroll}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

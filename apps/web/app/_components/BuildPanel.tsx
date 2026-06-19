"use client";

/**
 * BuildPanel — the M2 "Build" surface for the home team: a tactic picker and a
 * chemistry slider with a live effective-rating / λ preview (MVP §4.5, §4.6).
 *
 * The full player-placement Build screen lives in the main live game; this demo
 * drives chemistry with a slider so the engine effect is visible end-to-end.
 * The chosen `tactic` + `chem` feed `effectiveStrength` before the match runs.
 */

import {
  effectiveStrength,
  expectedGoals,
  type TeamStrength,
  type Tactic,
} from "7a0-engine";
import { STRINGS as S } from "../_data/strings";

const TACTICS: readonly Tactic[] = ["offensive", "balanced", "defensive"];

export function BuildPanel({
  homeBase,
  awayBase,
  tactic,
  chem,
  onTactic,
  onChem,
}: {
  homeBase: TeamStrength;
  awayBase: TeamStrength;
  tactic: Tactic;
  chem: number;
  onTactic: (t: Tactic) => void;
  onChem: (c: number) => void;
}) {
  const homeEff = effectiveStrength(homeBase, { chemistryPct: chem, tactic });
  // Away stays neutral in this demo (no opponent build).
  const lambdaHome = expectedGoals(homeEff.attack, awayBase.defense);
  const lambdaAway = expectedGoals(awayBase.attack, homeEff.defense);

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

      <div style={{ marginBottom: "0.9rem" }}>
        <label
          htmlFor="chem"
          style={{
            display: "block",
            color: "var(--muted)",
            marginBottom: "0.35rem",
          }}
        >
          {S.build.chemistry}: <strong>{chem}%</strong>
        </label>
        <input
          id="chem"
          type="range"
          min={0}
          max={100}
          value={chem}
          onChange={(e) => onChem(Number(e.target.value))}
          style={{ width: "100%", maxWidth: 360 }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          flexWrap: "wrap",
          fontVariantNumeric: "tabular-nums",
          fontSize: "0.9rem",
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
        <div>
          <div style={{ color: "var(--muted)" }}>{S.build.lambda}</div>
          <div>
            <strong>{lambdaHome.toFixed(2)}</strong> {S.vs}{" "}
            <strong>{lambdaAway.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

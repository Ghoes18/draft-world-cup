"use client";

import { useMemo, useState } from "react";
import {
  autoFillLineup,
  buildChemistryPercent,
  buildStateToLineup,
  buildStateToTeamStrength,
  demoCatalog,
  drawOpponentScenario,
  drawScenario,
  effectiveStrength,
  generateTimeline,
  getScenario,
  initBuildState,
  isLineupComplete,
  simulateMatch,
  type BuildState,
  type MatchTimeline,
  type Tactic,
} from "7a0-engine";
import { MatchView } from "./_components/MatchView";
import { BuildPanel } from "./_components/BuildPanel";
import { StatsPanel } from "./_components/StatsPanel";
import { STRINGS as S } from "./_data/strings";

function newSeed(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 12);
  }
  return `demo-${Date.now()}`;
}

export default function Page() {
  const [seed, setSeed] = useState<string | null>(null);
  const [buildState, setBuildState] = useState<BuildState | null>(null);
  const [opponentScenarioId, setOpponentScenarioId] = useState<string | null>(
    null,
  );
  const [timeline, setTimeline] = useState<MatchTimeline | null>(null);
  const [tactic, setTactic] = useState<Tactic>("balanced");

  const playerScenario = useMemo(() => {
    if (!seed) return null;
    return drawScenario(demoCatalog, seed);
  }, [seed]);

  const opponentScenario = useMemo(() => {
    if (!seed || !playerScenario) return null;
    if (opponentScenarioId) {
      return getScenario(demoCatalog, opponentScenarioId);
    }
    return drawOpponentScenario(demoCatalog, seed, playerScenario.id);
  }, [seed, playerScenario, opponentScenarioId]);

  const awayStrength = useMemo(() => {
    if (!seed || !opponentScenario) return null;
    const awayBuild = autoFillLineup(
      demoCatalog,
      initBuildState(demoCatalog, opponentScenario.id, `${seed}:away`, "away"),
    );
    return buildStateToTeamStrength(demoCatalog, awayBuild);
  }, [seed, opponentScenario]);

  function onRoll() {
    const nextSeed = newSeed();
    const scenario = drawScenario(demoCatalog, nextSeed);
    const opponent = drawOpponentScenario(demoCatalog, nextSeed, scenario.id);
    setSeed(nextSeed);
    setBuildState(initBuildState(demoCatalog, scenario.id, nextSeed, "home"));
    setOpponentScenarioId(opponent.id);
    setTimeline(null);
    setTactic("balanced");
  }

  function onSimulate() {
    if (!seed || !buildState || !playerScenario || !opponentScenario) return;

    const filled = isLineupComplete(buildState)
      ? buildState
      : autoFillLineup(demoCatalog, buildState);
    if (!isLineupComplete(filled)) return;

    setBuildState(filled);

    const chem = Math.round(buildChemistryPercent(demoCatalog, filled));
    const homeLineup = buildStateToLineup(demoCatalog, filled);
    const homeBase = buildStateToTeamStrength(demoCatalog, filled);

    const awayBuild = autoFillLineup(
      demoCatalog,
      initBuildState(demoCatalog, opponentScenario.id, `${seed}:away`, "away"),
    );
    const awayBase = buildStateToTeamStrength(demoCatalog, awayBuild);
    const awayLineup = buildStateToLineup(demoCatalog, awayBuild);

    const result = simulateMatch({
      home: effectiveStrength(homeBase, { chemistryPct: chem, tactic }),
      away: effectiveStrength(awayBase, { chemistryPct: 50, tactic: "balanced" }),
      seed,
      knockout: false,
    });

    const next = generateTimeline({
      result,
      seed,
      scenario: { team: playerScenario.team, cup: playerScenario.cup },
      lineups: { home: homeLineup, away: awayLineup },
    });
    setTimeline(next);
  }

  const canSimulate = buildState !== null;

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <h1 style={{ marginBottom: "0.25rem" }}>{S.title}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>{S.subtitle}</p>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap",
          margin: "1.25rem 0",
        }}
      >
        <button onClick={onRoll}>{S.roll}</button>
        {playerScenario && opponentScenario && (
          <>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              <strong>{playerScenario.team}</strong> {playerScenario.cup}{" "}
              {S.vs} <strong>{opponentScenario.team}</strong>{" "}
              {opponentScenario.cup}
            </span>
            <button onClick={onSimulate} disabled={!canSimulate}>
              {S.simulate}
            </button>
          </>
        )}
      </div>

      {buildState && playerScenario && opponentScenario && awayStrength && (
        <BuildPanel
          catalog={demoCatalog}
          scenarioLabel={`${playerScenario.team} · ${playerScenario.cup}`}
          awayStrength={awayStrength}
          buildState={buildState}
          onBuildState={setBuildState}
          tactic={tactic}
          onTactic={setTactic}
        />
      )}

      {timeline && playerScenario && opponentScenario ? (
        <>
          <MatchView
            key={timeline.seed}
            timeline={timeline}
            labels={{
              home: playerScenario.team,
              away: opponentScenario.team,
            }}
          />
          <StatsPanel
            timeline={timeline}
            labels={{
              home: playerScenario.team,
              away: opponentScenario.team,
            }}
          />
        </>
      ) : (
        <p style={{ color: "var(--muted)" }}>{S.noMatch}</p>
      )}
    </main>
  );
}

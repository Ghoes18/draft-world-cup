"use client";

import { useMemo, useState } from "react";
import {
  autoFillLineup,
  buildChemistryPercent,
  buildStateToLineup,
  buildStateToTeamStrength,
  drawFormationOptions,
  drawOpponentScenario,
  effectiveStrength,
  generateTimeline,
  getScenario,
  initBuildState,
  isLineupComplete,
  simulateMatch,
  type BuildState,
  type FormationDefinition,
  type MatchTimeline,
} from "7a0-engine";
import { MatchView } from "./_components/MatchView";
import { BuildPanel } from "./_components/BuildPanel";
import { FormationPicker } from "./_components/FormationPicker";
import { Footer } from "./_components/Footer";
import { Header } from "./_components/Header";
import { LegendTicker } from "./_components/LegendTicker";
import { StatsPanel } from "./_components/StatsPanel";
import { ResultCard } from "./_components/ResultCard";
import { Scorebug } from "./_components/Scoreboard";
import { PitchMarkings } from "./_components/PitchMarkings";
import { STRINGS as S } from "./_data/strings";
import { useGameCatalog } from "./_hooks/useGameCatalog";

function newSeed(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 12);
  }
  return `demo-${Date.now()}`;
}

export default function Page() {
  const { catalog, source, ready } = useGameCatalog();
  const [pendingSeed, setPendingSeed] = useState<string | null>(null);
  const [formationOptions, setFormationOptions] = useState<FormationDefinition[]>(
    [],
  );
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(
    null,
  );
  const [seed, setSeed] = useState<string | null>(null);
  const [buildState, setBuildState] = useState<BuildState | null>(null);
  const [opponentScenarioId, setOpponentScenarioId] = useState<string | null>(
    null,
  );
  const [timeline, setTimeline] = useState<MatchTimeline | null>(null);
  // The result, stats and final score stay hidden until the match has actually
  // been played to the end — no spoilers while the ticker is still running.
  const [matchDone, setMatchDone] = useState(false);

  const opponentScenario = useMemo(() => {
    if (!seed || !catalog) return null;
    if (opponentScenarioId) {
      return getScenario(catalog, opponentScenarioId);
    }
    if (buildState) {
      return drawOpponentScenario(
        catalog,
        seed,
        buildState.currentScenarioId,
      );
    }
    return null;
  }, [seed, buildState, opponentScenarioId, catalog]);

  const awayStrength = useMemo(() => {
    if (!seed || !opponentScenario || !catalog) return null;
    const awayBuild = autoFillLineup(
      catalog,
      initBuildState(catalog, `${seed}:away`, "away", opponentScenario.id),
    );
    return buildStateToTeamStrength(catalog, awayBuild);
  }, [seed, opponentScenario, catalog]);

  function onRoll() {
    if (!catalog) return;
    const nextSeed = newSeed();
    setPendingSeed(nextSeed);
    setFormationOptions(drawFormationOptions(nextSeed, 5));
    setSelectedFormationId(null);
    setSeed(null);
    setBuildState(null);
    setOpponentScenarioId(null);
    setTimeline(null);
    setMatchDone(false);
  }

  function onConfirmFormation() {
    if (!catalog || !pendingSeed || !selectedFormationId) return;
    const draft = initBuildState(
      catalog,
      pendingSeed,
      "home",
      undefined,
      selectedFormationId,
    );
    const opponent = drawOpponentScenario(
      catalog,
      pendingSeed,
      draft.currentScenarioId,
    );
    setSeed(pendingSeed);
    setBuildState(draft);
    setOpponentScenarioId(opponent.id);
    setPendingSeed(null);
    setFormationOptions([]);
    setSelectedFormationId(null);
  }

  function onSimulate() {
    if (!seed || !buildState || !opponentScenario || !catalog) return;

    const filled = isLineupComplete(buildState)
      ? buildState
      : autoFillLineup(catalog, buildState);
    if (!isLineupComplete(filled)) return;

    setBuildState(filled);

    const chem = Math.round(buildChemistryPercent(catalog, filled));
    const homeLineup = buildStateToLineup(catalog, filled);
    const homeBase = buildStateToTeamStrength(catalog, filled);

    const awayBuild = autoFillLineup(
      catalog,
      initBuildState(catalog, `${seed}:away`, "away", opponentScenario.id),
    );
    const awayBase = buildStateToTeamStrength(catalog, awayBuild);
    const awayLineup = buildStateToLineup(catalog, awayBuild);

    const firstPick = filled.slots.find((s) => s.pickedFromScenarioId);
    const homeLabel = firstPick?.pickedFromScenarioId
      ? getScenario(catalog, firstPick.pickedFromScenarioId)
      : getScenario(catalog, filled.currentScenarioId);

    const result = simulateMatch({
      home: effectiveStrength(homeBase, { chemistryPct: chem, tactic: "balanced" }),
      away: effectiveStrength(awayBase, { chemistryPct: 50, tactic: "balanced" }),
      seed,
      knockout: false,
    });

    const next = generateTimeline({
      result,
      seed,
      scenario: { team: homeLabel.team, cup: homeLabel.cup },
      lineups: { home: homeLineup, away: awayLineup },
    });
    setMatchDone(false);
    setTimeline(next);
  }

  const canSimulate = buildState !== null && catalog !== null;

  if (!ready) {
    return (
      <main className="shell">
        <p className="dim">{S.loading}</p>
      </main>
    );
  }

  const catalogHint =
    source === "full" && catalog
      ? S.build.catalogFull(catalog.scenarios.length)
      : S.build.catalogDemo;

  const draftLabel = buildState
    ? S.build.draftInProgress(buildState.turnIndex)
    : S.build.yourXi;
  // Final score/pens only surface once the match has been watched to the end.
  const score = matchDone ? timeline?.result.score : undefined;
  const pens = matchDone ? timeline?.result.penalties : undefined;
  const pickingFormation = pendingSeed !== null && buildState === null;
  const drawn = buildState && opponentScenario;

  return (
    <main className="shell">
      <Header meta={catalogHint} />

      <section className="hero">
        <PitchMarkings />
        <div className="hero__inner">
          <div className="hero__kicker">
            <span>{S.kickerLeft}</span>
            <span aria-hidden>·</span>
            <span>{S.kickerRight}</span>
          </div>

          <Scorebug
            homeLabel={drawn ? draftLabel : S.heroHome}
            awayLabel={drawn && opponentScenario ? opponentScenario.team : S.heroAway}
            awayTag={drawn && opponentScenario ? `’${opponentScenario.cup}` : undefined}
            homeScore={score ? score[0] : undefined}
            awayScore={score ? score[1] : undefined}
            pens={pens ? [pens[0], pens[1]] : undefined}
          />

          <LegendTicker />

          <div className="hero__cta">
            {!pickingFormation && (
              <button className="btn-kick" onClick={onRoll}>
                {buildState ? S.result.again : S.roll}
              </button>
            )}
            {buildState && (
              <button onClick={onSimulate} disabled={!canSimulate}>
                {S.simulate}
              </button>
            )}
          </div>

          {!drawn && !pickingFormation && (
            <p className="hero__hint">{S.noMatch}</p>
          )}
        </div>
      </section>

      {pickingFormation && formationOptions.length > 0 && (
        <FormationPicker
          options={formationOptions}
          selectedId={selectedFormationId}
          onSelect={setSelectedFormationId}
          onConfirm={onConfirmFormation}
        />
      )}

      {buildState && opponentScenario && awayStrength && catalog && (
        <BuildPanel
          catalog={catalog}
          awayStrength={awayStrength}
          buildState={buildState}
          onBuildState={setBuildState}
        />
      )}

      {timeline && opponentScenario && (
        <>
          <MatchView
            key={timeline.seed}
            timeline={timeline}
            labels={{
              home: S.build.yourXi,
              away: opponentScenario.team,
            }}
            onDone={() => setMatchDone(true)}
          />
          {/* Result and stats are held back until the match is over. */}
          {matchDone && (
            <>
              {seed && (
                <ResultCard
                  timeline={timeline}
                  homeLabel={S.build.yourXi}
                  awayLabel={opponentScenario.team}
                  awayTag={`’${opponentScenario.cup}`}
                  seed={seed}
                  onAgain={onRoll}
                />
              )}
              <StatsPanel
                timeline={timeline}
                labels={{
                  home: S.build.yourXi,
                  away: opponentScenario.team,
                }}
              />
            </>
          )}
        </>
      )}
      <Footer />
    </main>
  );
}

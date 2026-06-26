"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  autoFillLineup,
  bossSeed,
  buildStateToTeamStrength,
  drawFormationOptions,
  drawScenario,
  initBuildState,
  isLineupComplete,
  isoWeekKey,
  replayAndValidate,
  type BuildAction,
  type BuildState,
  type FormationDefinition,
  type MatchTimeline,
  type SquadCatalog,
  type TeamStrength,
} from "7a0-engine";
import { api } from "../../convex/_generated/api";
import { Header } from "../_components/Header";
import { Footer } from "../_components/Footer";
import { BuildPanel } from "../_components/BuildPanel";
import { FormationPicker } from "../_components/FormationPicker";
import { MatchView } from "../_components/MatchView";
import { StatsPanel } from "../_components/StatsPanel";
import { ResultCard } from "../_components/ResultCard";
import { MissionCard, type MissionView } from "../_components/MissionCard";
import { BossCard } from "../_components/BossCard";
import { usePlayerId } from "../_hooks/usePlayerId";
import { useGameCatalog } from "../_hooks/useGameCatalog";
import { STRINGS as S } from "../_data/strings";

const NEUTRAL_AWAY: TeamStrength = { attack: 80, defense: 80, overall: 80 };

function newSeed(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 12);
  }
  return `boss-${Date.now()}`;
}

type Phase = "overview" | "build" | "result";

interface BossOutcome {
  gf: number;
  ga: number;
  beat: boolean;
  timeline: MatchTimeline;
  missionsCompleted: string[];
}

export default function MissionsPage() {
  const { catalog, ready } = useGameCatalog();
  const { playerId, name } = usePlayerId();
  const convexReady = process.env.NEXT_PUBLIC_CONVEX_URL != null;

  return (
    <main className="shell">
      <Header meta={S.missions.heading} />
      {!ready || !catalog ? (
        <p className="dim">{S.loading}</p>
      ) : !convexReady ? (
        <section className="missions-page">
          <p className="panel__kicker mono dim">{S.missions.kicker}</p>
          <h1 className="missions-page__title">{S.missions.heading}</h1>
          <p className="dim">{S.missions.needConvex}</p>
        </section>
      ) : !playerId ? (
        <p className="dim">{S.missions.loading}</p>
      ) : (
        // All Convex hooks live below this gate — the provider only wraps the
        // app when NEXT_PUBLIC_CONVEX_URL is set (see ConvexClientProvider).
        <MissionsContent catalog={catalog} playerId={playerId} name={name} />
      )}
      <Footer />
    </main>
  );
}

function MissionsContent({
  catalog,
  playerId,
  name,
}: {
  catalog: SquadCatalog;
  playerId: string;
  name: string;
}) {
  const [phase, setPhase] = useState<Phase>("overview");
  const [outcome, setOutcome] = useState<BossOutcome | null>(null);
  const [matchDone, setMatchDone] = useState(false);

  const missions = useQuery(api.missions.myMissions, { playerId }) as
    | MissionView[]
    | undefined;
  const boss = useQuery(api.boss.currentBoss, {});
  const bossStatus = useQuery(api.boss.myBossStatus, { playerId });

  const daily = useMemo(() => missions?.filter((m) => m.type === "daily") ?? [], [missions]);
  const career = useMemo(
    () => missions?.filter((m) => m.type === "persistent") ?? [],
    [missions],
  );

  return (
    <>
      {phase === "overview" && (
        <Overview
          missionsLoading={missions === undefined}
          daily={daily}
          career={career}
          boss={boss ?? null}
          bossStatus={bossStatus ?? null}
          onChallenge={() => {
            setOutcome(null);
            setMatchDone(false);
            setPhase("build");
          }}
        />
      )}

      {phase === "build" && boss && (
        <BossBuild
          catalog={catalog}
          playerId={playerId}
          weekKey={boss.weekKey}
          onCancel={() => setPhase("overview")}
          onResolved={(o) => {
            setOutcome(o);
            setMatchDone(false);
            setPhase("result");
          }}
        />
      )}

      {phase === "result" && outcome && boss && (
        <>
          <MatchView
            key={outcome.timeline.seed}
            timeline={outcome.timeline}
            labels={{ home: name || S.heroHome, away: boss.scenario.team }}
            onDone={() => setMatchDone(true)}
          />
          {matchDone && (
            <>
              <ResultCard
                timeline={outcome.timeline}
                homeLabel={name || S.heroHome}
                awayLabel={boss.scenario.team}
                awayTag={`’${String(boss.scenario.cup).slice(-2)}`}
                seed={outcome.timeline.seed}
                onAgain={() => setPhase("overview")}
              />
              {outcome.missionsCompleted.length > 0 && (
                <p className="missions-toast" role="status">
                  {S.missions.completedToast(outcome.missionsCompleted.length)}
                </p>
              )}
              <StatsPanel
                timeline={outcome.timeline}
                labels={{ home: name || S.heroHome, away: boss.scenario.team }}
              />
            </>
          )}
        </>
      )}
    </>
  );
}

function Overview({
  missionsLoading,
  daily,
  career,
  boss,
  bossStatus,
  onChallenge,
}: {
  missionsLoading: boolean;
  daily: MissionView[];
  career: MissionView[];
  boss: { weekKey: string; scenario: { team: string; cup: number } } | null;
  bossStatus: { triedToday: boolean; today: BossResult; bestThisWeek: BossResult } | null;
  onChallenge: () => void;
}) {
  return (
    <>
      <section className="missions-page">
        <p className="panel__kicker mono dim">{S.missions.kicker}</p>
        <h1 className="missions-page__title">{S.missions.heading}</h1>

        {missionsLoading ? (
          <p className="dim">{S.missions.loading}</p>
        ) : (
          <>
            <h2 className="missions-page__group">{S.missions.daily}</h2>
            <p className="dim missions-page__hint">{S.missions.dailyHint}</p>
            <div className="missions-grid">
              {daily.map((m) => (
                <MissionCard key={m.id} mission={m} />
              ))}
            </div>

            <h2 className="missions-page__group">{S.missions.persistent}</h2>
            <p className="dim missions-page__hint">{S.missions.persistentHint}</p>
            <div className="missions-grid">
              {career.map((m) => (
                <MissionCard key={m.id} mission={m} />
              ))}
            </div>
          </>
        )}
      </section>

      {boss && (
        <BossCard
          team={boss.scenario.team}
          cup={boss.scenario.cup}
          triedToday={bossStatus?.triedToday ?? false}
          today={bossStatus?.today ?? null}
          bestThisWeek={bossStatus?.bestThisWeek ?? null}
          canChallenge={!(bossStatus?.triedToday ?? false)}
          onChallenge={onChallenge}
        />
      )}
    </>
  );
}

type BossResult = { gf: number; ga: number; beat: boolean } | null;

/** The Boss draft flow: pick a formation, build an XI, submit to the server. The
 *  server owns the match seed, so the result/timeline come back from the
 *  mutation rather than a local simulation. */
function BossBuild({
  catalog,
  playerId,
  weekKey,
  onCancel,
  onResolved,
}: {
  catalog: SquadCatalog;
  playerId: string;
  weekKey: string;
  onCancel: () => void;
  onResolved: (o: BossOutcome) => void;
}) {
  const challengeBoss = useMutation(api.boss.challengeBoss);
  const [seed] = useState(() => newSeed());
  const [formationOptions] = useState<FormationDefinition[]>(() =>
    drawFormationOptions(seed, 5),
  );
  const [pendingFormationId, setPendingFormationId] = useState<string | null>(null);
  const [formationId, setFormationId] = useState<string | null>(null);
  const [buildState, setBuildState] = useState<BuildState | null>(null);
  const actionsRef = useRef<BuildAction[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The exact weekly Boss XI strength, for the Build comparison meter.
  const bossStrength = useMemo<TeamStrength>(() => {
    try {
      const scenario = drawScenario(catalog, bossSeed(weekKey));
      const xi = autoFillLineup(
        catalog,
        initBuildState(catalog, bossSeed(weekKey), "away", scenario.id),
      );
      return buildStateToTeamStrength(catalog, xi);
    } catch {
      return NEUTRAL_AWAY;
    }
  }, [catalog, weekKey]);

  function confirmFormation() {
    if (!pendingFormationId) return;
    setFormationId(pendingFormationId);
    setBuildState(initBuildState(catalog, seed, "home", undefined, pendingFormationId));
  }

  const canSubmit = buildState !== null && isLineupComplete(buildState) && !submitting;

  const onSubmit = useCallback(async () => {
    if (!buildState || !formationId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const replay = replayAndValidate(catalog, {
        seed,
        side: "home",
        formationId,
        actions: actionsRef.current,
        tactic: "balanced",
      });
      if (!replay.ok) {
        throw new Error("Invalid build: " + replay.errors.map((e) => e.message).join(", "));
      }
      const res = await challengeBoss({
        playerId,
        seed,
        formationId,
        tactic: "balanced",
        actionsJson: JSON.stringify(actionsRef.current),
      });
      onResolved({
        gf: res.gf,
        ga: res.ga,
        beat: res.beat,
        timeline: res.timeline as MatchTimeline,
        missionsCompleted: res.missionsCompleted,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not challenge the Boss");
      setSubmitting(false);
    }
  }, [buildState, formationId, submitting, catalog, seed, challengeBoss, playerId, onResolved]);

  if (!formationId || !buildState) {
    return (
      <FormationPicker
        options={formationOptions}
        selectedId={pendingFormationId}
        onSelect={setPendingFormationId}
        onConfirm={confirmFormation}
      />
    );
  }

  return (
    <>
      <BuildPanel
        catalog={catalog}
        awayStrength={bossStrength}
        buildState={buildState}
        onBuildState={setBuildState}
        onAction={(a) => actionsRef.current.push(a)}
      />
      {error && <p className="draft-roll__rerolls--low">{error}</p>}
      <section className="hero__cta" style={{ padding: "1rem", display: "flex", gap: "1rem" }}>
        <button className="btn-kick" disabled={!canSubmit} onClick={onSubmit}>
          {submitting ? S.boss.building : S.boss.submit}
        </button>
        <button onClick={onCancel} disabled={submitting}>
          {S.result.again}
        </button>
      </section>
    </>
  );
}

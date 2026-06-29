"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useMutation } from "convex/react";
import {
  autoFillLineup,
  CAPTAIN_TSUBASA_SCENARIO_ID,
  drawFormationOptions,
  initBuildState,
  isLineupComplete,
  pickBotEntries,
  POOL_SIZE,
  replayAndValidate,
  resolveWorldCup,
  type BuildAction,
  type BuildState,
  type FormationDefinition,
  type ResolvedTournament,
} from "7a0-engine";
import { api } from "../convex/_generated/api";
import { useAuth } from "./_hooks/useAuth";
import { BuildPanel } from "./_components/BuildPanel";
import { FormationPicker } from "./_components/FormationPicker";
import { Footer } from "./_components/Footer";
import { Header } from "./_components/Header";
import { LegendTicker } from "./_components/LegendTicker";
import { Scorebug } from "./_components/Scoreboard";
import { PitchMarkings } from "./_components/PitchMarkings";
import { HeroStadiumBackdrop } from "./_components/three";
import { TournamentReveal } from "./_components/TournamentReveal";
import { useStrings } from "./_i18n/LocaleProvider";
import { useGameCatalog } from "./_hooks/useGameCatalog";
import { MissionsStrip } from "./_components/MissionsStrip";

const NEUTRAL_AWAY = { attack: 78, midfield: 78, defense: 78, overall: 78 };

function newSeed(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 12);
  }
  return `demo-${Date.now()}`;
}

type RecordMatchFn = (args: {
  seed: string;
  formationId: string;
  tactic: "offensive" | "balanced" | "defensive";
  actionsJson: string;
}) => Promise<{ ok: boolean; missionsCompleted: string[] }>;

function RecordMatchBridge({
  recordRef,
}: {
  recordRef: MutableRefObject<RecordMatchFn | null>;
}) {
  const recordMatch = useMutation(api.solo.recordMatch);
  useEffect(() => {
    recordRef.current = recordMatch;
    return () => {
      recordRef.current = null;
    };
  }, [recordMatch, recordRef]);
  return null;
}

export default function Page() {
  const S = useStrings();
  const { catalog, source, ready } = useGameCatalog();
  const { playerId, name, isAuthenticated } = useAuth();
  const convexReady = process.env.NEXT_PUBLIC_CONVEX_URL != null;
  const recordRef = useRef<RecordMatchFn | null>(null);
  const actionsRef = useRef<BuildAction[]>([]);
  const [pendingSeed, setPendingSeed] = useState<string | null>(null);
  const [formationOptions, setFormationOptions] = useState<FormationDefinition[]>([]);
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [buildState, setBuildState] = useState<BuildState | null>(null);
  const [tournament, setTournament] = useState<ResolvedTournament | null>(null);

  function resetRun() {
    setPendingSeed(null);
    setFormationOptions([]);
    setSelectedFormationId(null);
    setSeed(null);
    setBuildState(null);
    setTournament(null);
    actionsRef.current = [];
  }

  function onRoll() {
    if (!catalog) return;
    const nextSeed = newSeed();
    setPendingSeed(nextSeed);
    setFormationOptions(drawFormationOptions(nextSeed, 5));
    setSelectedFormationId(null);
    setSeed(null);
    setBuildState(null);
    setTournament(null);
    actionsRef.current = [];
  }

  function onConfirmFormation() {
    if (!catalog || !pendingSeed || !selectedFormationId) return;
    actionsRef.current = [];
    // TEST: name "Ghoes" forces the Captain Tsubasa easter egg as the first roll.
    // Triggered by the persisted name OR a `?as=ghoes` URL query (the solo page
    // has no name field, so the query param is the easy way to test).
    const queryName =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("as") ?? ""
        : "";
    const isGhoes =
      name.trim().toLowerCase() === "ghoes" ||
      queryName.trim().toLowerCase() === "ghoes";
    if (isGhoes) {
      console.warn("[easter-egg] Ghoes detected → first roll = Captain Tsubasa");
    }
    const startingScenarioId = isGhoes
      ? CAPTAIN_TSUBASA_SCENARIO_ID
      : undefined;
    const draft = initBuildState(
      catalog,
      pendingSeed,
      "home",
      startingScenarioId,
      selectedFormationId,
    );
    setSeed(pendingSeed);
    setBuildState(draft);
    setPendingSeed(null);
    setFormationOptions([]);
    setSelectedFormationId(null);
  }

  function onKickOff() {
    if (!seed || !buildState || !catalog) return;

    const replay = replayAndValidate(catalog, {
      seed,
      side: "home",
      formationId: buildState.formationId,
      actions: actionsRef.current,
      tactic: "balanced",
    });
    if (!replay.ok) return;

    const filled = isLineupComplete(replay.state)
      ? replay.state
      : autoFillLineup(catalog, replay.state);
    setBuildState(filled);

    const tournamentSeed = `${seed}:wc`;
    const humanEntry = {
      kind: "human" as const,
      name: S.build.yourXi,
      ...(playerId ? { playerId } : {}),
      resolve: (side: "home" | "away") => {
        const sideReplay = replayAndValidate(catalog, {
          seed,
          side,
          formationId: filled.formationId,
          actions: actionsRef.current,
          tactic: "balanced",
        });
        if (!sideReplay.ok) {
          return { buildState: filled, tactic: "balanced" as const };
        }
        const sideFilled = isLineupComplete(sideReplay.state)
          ? sideReplay.state
          : autoFillLineup(catalog, sideReplay.state);
        return { buildState: sideFilled, tactic: "balanced" as const };
      },
    };

    const bots = pickBotEntries(catalog, POOL_SIZE - 1, tournamentSeed);
    const resolved = resolveWorldCup(catalog, [humanEntry, ...bots], tournamentSeed);
    setTournament(resolved);

    if (isAuthenticated && recordRef.current) {
      recordRef.current({
        seed,
        formationId: filled.formationId,
        tactic: "balanced",
        actionsJson: JSON.stringify(actionsRef.current),
      }).catch(() => {});
    }
  }

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

  const pickingFormation = pendingSeed !== null && buildState === null;
  const isSoloActive = pickingFormation || buildState !== null || tournament !== null;

  const mySlot = tournament?.participants.find(
    (p) => p.kind === "human" && (playerId ? p.playerId === playerId : true),
  )?.slot;

  return (
    <main className="shell">
      {convexReady && <RecordMatchBridge recordRef={recordRef} />}

      {!isSoloActive && (
        <>
          <Header meta={catalogHint} />

          <section className="hero">
            <PitchMarkings />
            <HeroStadiumBackdrop />
            <div className="hero__inner">
              <div className="hero__kicker">
                <span>{S.kickerLeft}</span>
                <span aria-hidden>·</span>
                <span>{S.kickerRight}</span>
              </div>

              <Scorebug homeLabel={S.heroHome} awayLabel={S.heroAway} />

              <LegendTicker />

              <div className="hero__cta">
                <a href="/duel" className="btn-kick">{S.nav.duel}</a>
                <button className="btn-ghost" type="button" onClick={onRoll}>
                  {S.roll}
                </button>
              </div>
            </div>
          </section>

          {convexReady && isAuthenticated && playerId && (
            <MissionsStrip />
          )}
        </>
      )}

      {buildState && !tournament && (
        <section className="solo-bar" aria-label="Match actions">
          <button className="btn-kick" type="button" onClick={onRoll}>
            {S.result.again}
          </button>
          <button type="button" onClick={onKickOff}>
            {S.simulate}
          </button>
        </section>
      )}

      {pickingFormation && formationOptions.length > 0 && (
        <FormationPicker
          options={formationOptions}
          selectedId={selectedFormationId}
          onSelect={setSelectedFormationId}
          onConfirm={onConfirmFormation}
        />
      )}

      {buildState && !tournament && catalog && (
        <BuildPanel
          catalog={catalog}
          awayStrength={NEUTRAL_AWAY}
          buildState={buildState}
          onBuildState={setBuildState}
          onAction={(a) => actionsRef.current.push(a)}
        />
      )}

      {tournament && (
        <TournamentReveal
          state={tournament}
          mySlot={mySlot}
          onPlayAgain={() => {
            resetRun();
            onRoll();
          }}
          playAgainLabel={S.result.again}
        />
      )}

      <Footer />
    </main>
  );
}

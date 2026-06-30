"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  drawFormationOptions,
  hydrateCatalog,
  initBuildState,
  isLineupComplete,
  replayAndValidate,
  withCaptainTsubasa,
  type BuildAction,
  type BuildState,
  type FormationDefinition,
  type MatchTimeline,
  type SquadCatalog,
  type TeamStrength,
} from "7a0-engine";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { BuildPanel } from "../_components/BuildPanel";
import { DraftSetupWizard } from "../_components/DraftSetupWizard";
import { FormationPicker } from "../_components/FormationPicker";
import { Header } from "../_components/Header";
import { Footer } from "../_components/Footer";
import { TournamentReveal } from "../_components/TournamentReveal";
import { AuthGate } from "../_components/AuthGate";
import { useAuth } from "../_hooks/useAuth";
import { useStrings } from "../_i18n/LocaleProvider";

const NEUTRAL_AWAY: TeamStrength = { attack: 78, midfield: 78, defense: 78, overall: 78 };

/** Tournament catalog — same pipeline as `convex/duelCatalog` (`hydrateCatalog` + hidden easter egg). */
function useDuelCatalog(): { catalog: SquadCatalog | null; error: boolean } {
  const [catalog, setCatalog] = useState<SquadCatalog | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/catalog.json")
      .then((r) => (r.ok ? (r.json() as Promise<SquadCatalog>) : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.scenarios?.length)
          setCatalog(withCaptainTsubasa(hydrateCatalog(data)));
        else setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, error };
}

function newSeed(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 12);
  }
  return `duel-${Date.now()}`;
}

type Phase = "build" | "searching" | "reveal";

type TournamentState = NonNullable<FunctionReturnType<typeof api.tournament.tournamentState>>;

/** Draft state lives here (not inside BuildStep) so it survives a "Cancel"
 * round-trip through `searching` — only an explicit reroll or "Search again"
 * should ever discard an in-progress squad. */
function useDraftState(catalog: SquadCatalog | null) {
  const [seed, setSeedState] = useState<string>(() => newSeed());
  const [formationOptions, setFormationOptions] = useState<FormationDefinition[]>(
    () => drawFormationOptions(seed, 5),
  );
  const [pendingFormationId, setPendingFormationId] = useState<string | null>(null);
  const [formationId, setFormationId] = useState<string | null>(null);
  const [buildState, setBuildState] = useState<BuildState | null>(null);
  const actionsRef = useRef<BuildAction[]>([]);

  function reset() {
    const next = newSeed();
    setSeedState(next);
    setFormationOptions(drawFormationOptions(next, 5));
    setPendingFormationId(null);
    setFormationId(null);
    setBuildState(null);
    actionsRef.current = [];
  }

  function confirmFormation() {
    if (!pendingFormationId || !catalog) return;
    setFormationId(pendingFormationId);
    setBuildState(initBuildState(catalog, seed, "home", undefined, pendingFormationId));
  }

  return {
    seed,
    formationOptions,
    pendingFormationId,
    setPendingFormationId,
    formationId,
    buildState,
    setBuildState,
    actionsRef,
    reset,
    confirmFormation,
  };
}

export default function DuelPage() {
  const S = useStrings();
  const { playerId, isAuthenticated, isLoading } = useAuth();
  const convexReady = process.env.NEXT_PUBLIC_CONVEX_URL != null;

  const [phase, setPhase] = useState<Phase>("build");
  const [tournamentId, setTournamentId] = useState<TournamentState["tournamentId"] | null>(null);
  const { catalog, error: catalogError } = useDuelCatalog();
  const draft = useDraftState(catalog);

  return (
    <main className="shell">
      <Header meta={S.brand.metaOnline} />
      {!convexReady ? (
        <SetupHint />
      ) : isLoading ? (
        <p className="dim">{S.auth.loading}</p>
      ) : !isAuthenticated || !playerId ? (
        <AuthGate>{null}</AuthGate>
      ) : catalogError ? (
        <CatalogError />
      ) : !catalog ? (
        <p className="dim">{S.duel.loadingSquads}</p>
      ) : phase === "build" ? (
        <BuildStep
          catalog={catalog}
          draft={draft}
          onQueued={() => setPhase("searching")}
          onMatched={(id) => {
            setTournamentId(id);
            setPhase("reveal");
          }}
        />
      ) : phase === "searching" ? (
        <SearchingStep
          onMatched={(id) => {
            setTournamentId(id);
            setPhase("reveal");
          }}
          onCancel={() => setPhase("build")}
        />
      ) : tournamentId ? (
        <RevealStep
          tournamentId={tournamentId}
          playerId={playerId}
          onSearchAgain={() => {
            draft.reset();
            setTournamentId(null);
            setPhase("build");
          }}
        />
      ) : null}
      <Footer />
    </main>
  );
}

function SetupHint() {
  const S = useStrings();
  return (
    <section className="panel" style={{ padding: "1.5rem" }}>
      <h2 className="panel__title">{S.duel.needConvexTitle}</h2>
      <p className="dim">{S.duel.needConvexBody}</p>
    </section>
  );
}

function CatalogError() {
  const S = useStrings();
  return (
    <section className="panel" style={{ padding: "1.5rem" }}>
      <h2 className="panel__title">{S.duel.catalogErrorTitle}</h2>
      <p className="dim">{S.duel.catalogErrorBody}</p>
    </section>
  );
}

/** Solo, untimed draft — identical UX to the home page's Build flow, but the
 * action log is recorded (`onAction`) so the server can replay/validate it,
 * and "Join World Cup" replaces "Simulate" as the terminal action. Draft
 * state itself lives in the parent (`useDraftState`) so a "Cancel" back out
 * of `searching` returns here with the same squad, not a fresh one. */
function BuildStep({
  catalog,
  draft,
  onQueued,
  onMatched,
}: {
  catalog: SquadCatalog;
  draft: ReturnType<typeof useDraftState>;
  onQueued: () => void;
  onMatched: (tournamentId: TournamentState["tournamentId"]) => void;
}) {
  const S = useStrings();
  const joinQueue = useMutation(api.tournament.joinQueue);
  const { seed, formationOptions, pendingFormationId, setPendingFormationId, formationId, buildState, setBuildState, actionsRef, reset, confirmFormation } = draft;

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const wizardStep = buildState && formationId ? 2 : 1;

  const canJoin = buildState !== null && isLineupComplete(buildState);

  const onJoinWorldCup = useCallback(async () => {
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
        throw new Error(
          `BOSS_INVALID_BUILD:${replay.errors.map((e) => e.message).join(", ")}`,
        );
      }
      const res = await joinQueue({
        seed,
        formationId,
        tactic: "balanced",
        actionsJson: JSON.stringify(actionsRef.current),
      });
      if (res.status === "matched") onMatched(res.tournamentId);
      else onQueued();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg.startsWith("BOSS_INVALID_BUILD:") ? S.errors.invalidBuild(msg.slice("BOSS_INVALID_BUILD:".length)) : msg || S.duel.joinFailed);
      setSubmitting(false);
    }
  }, [buildState, formationId, submitting, joinQueue, seed, actionsRef, onMatched, onQueued, catalog, S]);

  function onRerollSquad() {
    reset();
  }

  function onConfirmFormation() {
    confirmFormation();
  }

  return (
    <DraftSetupWizard step={wizardStep}>
      {wizardStep === 1 && (
        <FormationPicker
          options={formationOptions}
          selectedId={pendingFormationId}
          onSelect={setPendingFormationId}
          onConfirm={onConfirmFormation}
        />
      )}

      {wizardStep === 2 && buildState && (
        <>
          <BuildPanel
            catalog={catalog}
            awayStrength={NEUTRAL_AWAY}
            buildState={buildState}
            onBuildState={setBuildState}
            onAction={(a) => actionsRef.current.push(a)}
          />
          {error && <p className="draft-roll__rerolls--low">{error}</p>}
          <section className="hero__cta" style={{ padding: "1rem", display: "flex", gap: "1rem" }}>
            <button className="btn-kick" disabled={!canJoin || submitting} onClick={onJoinWorldCup}>
              {submitting ? S.duel.joining : S.duel.joinWorldCup}
            </button>
            <button onClick={onRerollSquad} disabled={submitting}>
              {S.duel.rerollSquad}
            </button>
          </section>
        </>
      )}
    </DraftSetupWizard>
  );
}

function SearchingStep({
  onMatched,
  onCancel,
}: {
  onMatched: (tournamentId: TournamentState["tournamentId"]) => void;
  onCancel: () => void;
}) {
  const S = useStrings();
  const leaveQueue = useMutation(api.tournament.leaveQueue);
  const heartbeat = useMutation(api.tournament.heartbeat);
  const status = useQuery(api.tournament.myQueueStatus, {});

  useEffect(() => {
    const tick = () => heartbeat({}).catch(() => {});
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [heartbeat]);

  useEffect(() => {
    if (status?.status === "matched") onMatched(status.tournamentId);
  }, [status, onMatched]);

  const waitingCount = status?.status === "waiting" ? status.waitingCount : 1;
  const poolSize = status?.status === "waiting" ? status.poolSize : 8;

  return (
    <section className="panel" style={{ padding: "1.5rem", textAlign: "center" }}>
      <h2 className="panel__title">{S.duel.fillingTitle}</h2>
      <p className="dim mono">
        {S.duel.waitingCount(waitingCount, poolSize)}
      </p>
      <p className="dim">{S.duel.fillingHint}</p>
      <button
        onClick={async () => {
          await leaveQueue({});
          onCancel();
        }}
      >
        {S.duel.cancel}
      </button>
    </section>
  );
}

function RevealStep({
  tournamentId,
  playerId,
  onSearchAgain,
}: {
  tournamentId: TournamentState["tournamentId"];
  playerId: string;
  onSearchAgain: () => void;
}) {
  const S = useStrings();
  const state = useQuery(api.tournament.tournamentState, { tournamentId });
  const rating = useQuery(api.ratings.myRating, {});
  const leaveQueue = useMutation(api.tournament.leaveQueue);

  useEffect(() => {
    leaveQueue({}).catch(() => {});
  }, [leaveQueue]);

  if (state === undefined) return <p className="dim">{S.duel.loadingTournament}</p>;
  if (state === null) return <p className="dim">{S.duel.tournamentNotFound}</p>;

  const mySlot = state.participants.find((p) => p.playerId === playerId)?.slot;
  // Only surface a delta when the rating row reflects *this* tournament.
  const ratedThis = rating?.rated && rating.lastTournamentId === tournamentId;

  return (
    <TournamentReveal
      state={{
        seed: state.tournamentId,
        championSlot: state.championSlot,
        participants: state.participants,
        matches: state.matches.map((m) => ({
          stage: m.stage,
          homeSlot: m.homeSlot,
          awaySlot: m.awaySlot,
          seed: m.seed,
          gf: m.gf,
          ga: m.ga,
          timeline: m.timeline as MatchTimeline,
          ...(m.groupIndex !== undefined ? { groupIndex: m.groupIndex } : {}),
          ...(m.winnerSlot !== undefined ? { winnerSlot: m.winnerSlot } : {}),
        })),
        standings: state.standings,
        tournamentId: state.tournamentId,
      }}
      mySlot={mySlot}
      onPlayAgain={onSearchAgain}
      playAgainLabel={S.duel.playAgain}
      {...(ratedThis
        ? { myElo: rating!.elo, ...(rating!.lastDelta !== undefined ? { myEloDelta: rating!.lastDelta } : {}) }
        : {})}
    />
  );
}

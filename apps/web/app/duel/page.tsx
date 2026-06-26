"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  drawFormationOptions,
  hydrateCatalog,
  initBuildState,
  isLineupComplete,
  replayAndValidate,
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
import { DraftSetupWizard, NameSetupStep } from "../_components/DraftSetupWizard";
import { FormationPicker } from "../_components/FormationPicker";
import { Header } from "../_components/Header";
import { Footer } from "../_components/Footer";
import { TournamentReveal } from "../_components/TournamentReveal";
import { usePlayerId } from "../_hooks/usePlayerId";
import { STRINGS as S } from "../_data/strings";

const NEUTRAL_AWAY: TeamStrength = { attack: 78, midfield: 78, defense: 78, overall: 78 };

/** Tournament catalog — same JSON + `hydrateCatalog` pass as `convex/duelCatalog`. */
function useDuelCatalog(): { catalog: SquadCatalog | null; error: boolean } {
  const [catalog, setCatalog] = useState<SquadCatalog | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/catalog.json")
      .then((r) => (r.ok ? (r.json() as Promise<SquadCatalog>) : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.scenarios?.length) setCatalog(hydrateCatalog(data));
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
  const { playerId, name, setName } = usePlayerId();
  const convexReady = process.env.NEXT_PUBLIC_CONVEX_URL != null;

  const [phase, setPhase] = useState<Phase>("build");
  const [tournamentId, setTournamentId] = useState<TournamentState["tournamentId"] | null>(null);
  const { catalog, error: catalogError } = useDuelCatalog();
  const draft = useDraftState(catalog);

  return (
    <main className="shell">
      <Header meta="Online · World Cup" />
      {!convexReady ? (
        <SetupHint />
      ) : !playerId ? (
        <p className="dim">Loading…</p>
      ) : catalogError ? (
        <CatalogError />
      ) : !catalog ? (
        <p className="dim">Loading squads…</p>
      ) : phase === "build" ? (
        <BuildStep
          catalog={catalog}
          draft={draft}
          playerId={playerId}
          name={name}
          setName={setName}
          onQueued={() => setPhase("searching")}
          onMatched={(id) => {
            setTournamentId(id);
            setPhase("reveal");
          }}
        />
      ) : phase === "searching" ? (
        <SearchingStep
          playerId={playerId}
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
  return (
    <section className="panel" style={{ padding: "1.5rem" }}>
      <h2 className="panel__title">Online World Cup needs Convex</h2>
      <p className="dim">
        Run <code>pnpm build</code> (engine) then <code>npx convex dev</code> in{" "}
        <code>apps/web</code>. That writes <code>NEXT_PUBLIC_CONVEX_URL</code> to{" "}
        <code>.env.local</code>. Restart <code>next dev</code> and reload.
      </p>
    </section>
  );
}

function CatalogError() {
  return (
    <section className="panel" style={{ padding: "1.5rem" }}>
      <h2 className="panel__title">Couldn’t load the squad catalog</h2>
      <p className="dim">
        The online World Cup needs <code>/catalog.json</code>. Run{" "}
        <code>pnpm build:catalog</code> (root), then reload. Joining is blocked
        until it loads — the server validates drafts against the same file.
      </p>
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
  playerId,
  name,
  setName,
  onQueued,
  onMatched,
}: {
  catalog: SquadCatalog;
  draft: ReturnType<typeof useDraftState>;
  playerId: string;
  name: string;
  setName: (n: string) => void;
  onQueued: () => void;
  onMatched: (tournamentId: TournamentState["tournamentId"]) => void;
}) {
  const joinQueue = useMutation(api.tournament.joinQueue);
  const { seed, formationOptions, pendingFormationId, setPendingFormationId, formationId, buildState, setBuildState, actionsRef, reset, confirmFormation } = draft;

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nameDone, setNameDone] = useState(false);

  const wizardStep =
    buildState && formationId ? 3 : nameDone ? 2 : 1;

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
          "Invalid build: " + replay.errors.map((e) => e.message).join(", "),
        );
      }
      const res = await joinQueue({
        playerId,
        name,
        seed,
        formationId,
        tactic: "balanced",
        actionsJson: JSON.stringify(actionsRef.current),
      });
      if (res.status === "matched") onMatched(res.tournamentId);
      else onQueued();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join the World Cup");
      setSubmitting(false);
    }
  }, [buildState, formationId, submitting, joinQueue, playerId, name, seed, actionsRef, onMatched, onQueued, catalog]);

  function onRerollSquad() {
    reset();
    setNameDone(true);
  }

  function onConfirmFormation() {
    confirmFormation();
    setNameDone(true);
  }

  return (
    <DraftSetupWizard step={wizardStep}>
      {wizardStep === 1 && (
        <NameSetupStep
          name={name}
          onNameChange={setName}
          onContinue={() => setNameDone(true)}
        />
      )}

      {wizardStep === 2 && (
        <FormationPicker
          options={formationOptions}
          selectedId={pendingFormationId}
          onSelect={setPendingFormationId}
          onConfirm={onConfirmFormation}
        />
      )}

      {wizardStep === 3 && buildState && (
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
              {submitting ? "Joining…" : "Join World Cup"}
            </button>
            <button onClick={onRerollSquad} disabled={submitting}>
              Reroll squad
            </button>
          </section>
        </>
      )}
    </DraftSetupWizard>
  );
}

function SearchingStep({
  playerId,
  onMatched,
  onCancel,
}: {
  playerId: string;
  onMatched: (tournamentId: TournamentState["tournamentId"]) => void;
  onCancel: () => void;
}) {
  const leaveQueue = useMutation(api.tournament.leaveQueue);
  const heartbeat = useMutation(api.tournament.heartbeat);
  const status = useQuery(api.tournament.myQueueStatus, { playerId });

  useEffect(() => {
    const tick = () => heartbeat({ playerId }).catch(() => {});
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [playerId, heartbeat]);

  useEffect(() => {
    if (status?.status === "matched") onMatched(status.tournamentId);
  }, [status, onMatched]);

  const waitingCount = status?.status === "waiting" ? status.waitingCount : 1;
  const poolSize = status?.status === "waiting" ? status.poolSize : 8;

  return (
    <section className="panel" style={{ padding: "1.5rem", textAlign: "center" }}>
      <h2 className="panel__title">Filling the World Cup…</h2>
      <p className="dim mono">
        {waitingCount} / {poolSize} players
      </p>
      <p className="dim">
        We'll auto-fill with real historical squads if the pool doesn't fill in time —
        either way, kickoff is coming.
      </p>
      <button
        onClick={async () => {
          await leaveQueue({ playerId });
          onCancel();
        }}
      >
        Cancel
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
  const state = useQuery(api.tournament.tournamentState, { tournamentId });
  const leaveQueue = useMutation(api.tournament.leaveQueue);

  useEffect(() => {
    leaveQueue({ playerId }).catch(() => {});
  }, [playerId, leaveQueue]);

  if (state === undefined) return <p className="dim">Loading tournament…</p>;
  if (state === null) return <p className="dim">Tournament not found.</p>;

  const mySlot = state.participants.find((p) => p.playerId === playerId)?.slot;

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
    />
  );
}

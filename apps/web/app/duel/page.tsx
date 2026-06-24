"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  drawFormationOptions,
  initBuildState,
  isLineupComplete,
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
import { FormationPicker } from "../_components/FormationPicker";
import { MatchView } from "../_components/MatchView";
import { StatsPanel } from "../_components/StatsPanel";
import { Header } from "../_components/Header";
import { Footer } from "../_components/Footer";
import { usePlayerId } from "../_hooks/usePlayerId";

const NEUTRAL_AWAY: TeamStrength = { attack: 78, defense: 78, overall: 78 };

/** The tournament is played on the full 85-nation catalog — the exact bytes
 * the server bundles as `duelCatalog` (both read `public/catalog.json`), so a
 * replayed action log rolls the same scenarios on both sides. We use the RAW
 * fetched catalog (no overlays/photos), matching what the server validates
 * against. On load failure we must NOT fall back to a different catalog — the
 * server would reject the draft — so the duel UI stays blocked until it loads. */
function useDuelCatalog(): { catalog: SquadCatalog | null; error: boolean } {
  const [catalog, setCatalog] = useState<SquadCatalog | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/catalog.json")
      .then((r) => (r.ok ? (r.json() as Promise<SquadCatalog>) : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.scenarios?.length) setCatalog(data);
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

  const canJoin = buildState !== null && isLineupComplete(buildState);

  const onJoinWorldCup = useCallback(async () => {
    if (!buildState || !formationId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
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
  }, [buildState, formationId, submitting, joinQueue, playerId, name, seed, actionsRef, onMatched, onQueued]);

  return (
    <>
      <section className="panel" style={{ padding: "1.5rem", display: "grid", gap: "1rem" }}>
        <div>
          <span className="label">Your name</span>
          <input
            className="seg"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>
        {error && <p className="draft-roll__rerolls--low">{error}</p>}
      </section>

      {!formationId || !buildState ? (
        <FormationPicker
          options={formationOptions}
          selectedId={pendingFormationId}
          onSelect={setPendingFormationId}
          onConfirm={confirmFormation}
        />
      ) : (
        <>
          <BuildPanel
            catalog={catalog}
            awayStrength={NEUTRAL_AWAY}
            buildState={buildState}
            onBuildState={setBuildState}
            onAction={(a) => actionsRef.current.push(a)}
          />
          <section className="hero__cta" style={{ padding: "1rem", display: "flex", gap: "1rem" }}>
            <button className="btn-kick" disabled={!canJoin || submitting} onClick={onJoinWorldCup}>
              {submitting ? "Joining…" : "Join World Cup"}
            </button>
            <button onClick={reset} disabled={submitting}>
              Reroll squad
            </button>
          </section>
        </>
      )}
    </>
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

function slotName(participants: TournamentState["participants"], slot: number): string {
  return participants.find((p) => p.slot === slot)?.name ?? `Slot ${slot}`;
}

function myJourney(state: TournamentState, mySlot: number): string {
  const myGroup = state.participants.find((p) => p.slot === mySlot)?.groupIndex;
  const final = state.matches.find((m) => m.stage === "final");
  const semis = state.matches.filter((m) => m.stage === "semi");
  if (state.championSlot === mySlot) return "🏆 Champion!";
  if (final && (final.homeSlot === mySlot || final.awaySlot === mySlot)) return "Runner-up";
  const mySemi = semis.find((m) => m.homeSlot === mySlot || m.awaySlot === mySlot);
  if (mySemi) return "Eliminated in the semifinal";
  const standing = state.standings.find((s) => s.groupIndex === myGroup);
  const rank = standing?.table.findIndex((t) => t.slot === mySlot) ?? -1;
  if (rank >= 0 && rank < 2) return "Advanced from the group — eliminated before the semifinal";
  return "Eliminated in the group stage";
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
  const [expanded, setExpanded] = useState<number | null>(null);

  const mySlot = useMemo(
    () => state?.participants.find((p) => p.playerId === playerId)?.slot,
    [state, playerId],
  );

  // The player's queue seat is fully consumed once the tournament is read —
  // clear it so it never lingers and gets miscounted by a future pool.
  useEffect(() => {
    leaveQueue({ playerId }).catch(() => {});
  }, [playerId, leaveQueue]);

  if (state === undefined) return <p className="dim">Loading tournament…</p>;
  if (state === null) return <p className="dim">Tournament not found.</p>;

  const myMatches = state.matches.filter(
    (m) => mySlot !== undefined && (m.homeSlot === mySlot || m.awaySlot === mySlot),
  );
  const semis = state.matches.filter((m) => m.stage === "semi");
  const final = state.matches.find((m) => m.stage === "final");

  return (
    <>
      <section className="panel" style={{ padding: "1rem", textAlign: "center" }}>
        <h2 className="panel__title">
          {mySlot !== undefined ? myJourney(state, mySlot) : "Tournament complete"}
        </h2>
        <p className="mono dim">Champion: {slotName(state.participants, state.championSlot)}</p>
      </section>

      <section className="panel" style={{ padding: "1rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        {state.standings.map((group) => (
          <div key={group.groupIndex} style={{ flex: "1 1 280px" }}>
            <h3 className="panel__title">Group {group.groupIndex === 0 ? "A" : "B"}</h3>
            <table className="mono" style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th align="left">Team</th>
                  <th>P</th>
                  <th>GD</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {group.table.map((row) => (
                  <tr
                    key={row.slot}
                    style={row.slot === mySlot ? { fontWeight: "bold" } : undefined}
                  >
                    <td>{slotName(state.participants, row.slot)}</td>
                    <td align="center">{row.played}</td>
                    <td align="center">{row.gd}</td>
                    <td align="center">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      {mySlot !== undefined && (
        <section className="panel" style={{ padding: "1rem" }}>
          <h3 className="panel__title">Your group fixtures</h3>
          {myMatches
            .filter((m) => m.stage === "group")
            .map((m, i) => {
              const home = slotName(state.participants, m.homeSlot);
              const away = slotName(state.participants, m.awaySlot);
              const key = state.matches.indexOf(m);
              return (
                <div key={i} style={{ marginBottom: "0.5rem" }}>
                  <button
                    className="mono"
                    onClick={() => setExpanded(expanded === key ? null : key)}
                    style={{ width: "100%", textAlign: "left" }}
                  >
                    {home} {m.gf}–{m.ga} {away}
                  </button>
                  {expanded === key && (
                    <FixtureDetail timeline={m.timeline as MatchTimeline} home={home} away={away} />
                  )}
                </div>
              );
            })}
        </section>
      )}

      <section className="panel" style={{ padding: "1rem" }}>
        <h3 className="panel__title">Knockout bracket</h3>
        {semis.map((m, i) => {
          const home = slotName(state.participants, m.homeSlot);
          const away = slotName(state.participants, m.awaySlot);
          const key = state.matches.indexOf(m);
          return (
            <div key={`sf-${i}`} style={{ marginBottom: "0.5rem" }}>
              <button
                className="mono"
                onClick={() => setExpanded(expanded === key ? null : key)}
                style={{ width: "100%", textAlign: "left" }}
              >
                Semifinal {i + 1}: {home} {m.gf}–{m.ga} {away}
              </button>
              {expanded === key && (
                <FixtureDetail timeline={m.timeline as MatchTimeline} home={home} away={away} />
              )}
            </div>
          );
        })}
        {final && (
          <div>
            <button
              className="mono"
              onClick={() =>
                setExpanded(expanded === state.matches.indexOf(final) ? null : state.matches.indexOf(final))
              }
              style={{ width: "100%", textAlign: "left" }}
            >
              Final: {slotName(state.participants, final.homeSlot)} {final.gf}–{final.ga}{" "}
              {slotName(state.participants, final.awaySlot)}
            </button>
            {expanded === state.matches.indexOf(final) && (
              <FixtureDetail
                timeline={final.timeline as MatchTimeline}
                home={slotName(state.participants, final.homeSlot)}
                away={slotName(state.participants, final.awaySlot)}
              />
            )}
          </div>
        )}
      </section>

      <section className="hero__cta" style={{ padding: "1rem", textAlign: "center" }}>
        <button className="btn-kick" onClick={onSearchAgain}>
          Search again with a new squad
        </button>
      </section>
    </>
  );
}

function FixtureDetail({
  timeline,
  home,
  away,
}: {
  timeline: MatchTimeline;
  home: string;
  away: string;
}) {
  const labels = { home, away };
  return (
    <>
      <MatchView key={timeline.seed} timeline={timeline} labels={labels} />
      <StatsPanel timeline={timeline} labels={labels} />
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  demoCatalog,
  getFormation,
  initBuildState,
  type BuildAction,
  type BuildState,
  type FormationDefinition,
  type MatchTimeline,
  type Side,
  type TeamStrength,
} from "7a0-engine";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { BuildPanel } from "../_components/BuildPanel";
import { FormationPicker } from "../_components/FormationPicker";
import { MatchView } from "../_components/MatchView";
import { ResultCard } from "../_components/ResultCard";
import { StatsPanel } from "../_components/StatsPanel";
import { Header } from "../_components/Header";
import { Footer } from "../_components/Footer";
import { usePlayerId } from "../_hooks/usePlayerId";

/** The duel is played on the engine's demo catalog — identical to the server's
 * `duelCatalog`, so the shared draft seed rolls the same scenarios on both. */
const CATALOG = demoCatalog;
const NEUTRAL_AWAY: TeamStrength = { attack: 78, defense: 78, overall: 78 };

type RoomPlayer = {
  playerId: string;
  name: string;
  seat: string;
  presence: string;
  confirmed: boolean;
  lastSeen: number;
};

type RoomState = NonNullable<FunctionReturnType<typeof api.duel.roomState>> & {
  players: RoomPlayer[];
};

function useRoom(code: string | null) {
  return useQuery(api.duel.roomState, code ? { code } : "skip");
}

export default function DuelPage() {
  const { playerId, name, setName } = usePlayerId();
  const [code, setCode] = useState<string | null>(null);

  // Pick up ?code= from an invite link on first load.
  useEffect(() => {
    const url = new URL(window.location.href);
    const c = url.searchParams.get("code");
    if (c) setCode(c.toUpperCase());
  }, []);

  const room = useRoom(code);
  const convexReady = process.env.NEXT_PUBLIC_CONVEX_URL != null;

  return (
    <main className="shell">
      <Header meta="Online Duel · 1v1" />
      {!convexReady ? (
        <SetupHint />
      ) : !playerId ? (
        <p className="dim">Loading…</p>
      ) : !code || room === null ? (
        <Lobby
          playerId={playerId}
          name={name}
          setName={setName}
          notFound={code != null && room === null}
          onEnter={setCode}
        />
      ) : room === undefined ? (
        <p className="dim">Connecting to room {code}…</p>
      ) : (
        <Room room={room} playerId={playerId} onLeave={() => setCode(null)} />
      )}
      <Footer />
    </main>
  );
}

function SetupHint() {
  return (
    <section className="panel" style={{ padding: "1.5rem" }}>
      <h2 className="panel__title">Online duel needs Convex</h2>
      <p className="dim">
        Run <code>pnpm build</code> (engine) then <code>npx convex dev</code> in{" "}
        <code>apps/web</code>. That writes <code>NEXT_PUBLIC_CONVEX_URL</code> to{" "}
        <code>.env.local</code>. Restart <code>next dev</code> and reload.
      </p>
    </section>
  );
}

function Lobby({
  playerId,
  name,
  setName,
  notFound,
  onEnter,
}: {
  playerId: string;
  name: string;
  setName: (n: string) => void;
  notFound: boolean;
  onEnter: (code: string) => void;
}) {
  const createRoom = useMutation(api.duel.createRoom);
  const joinRoom = useMutation(api.duel.joinRoom);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setError(null);
    const { code } = await createRoom({ playerId, name });
    onEnter(code);
  }

  async function onJoin() {
    setError(null);
    const c = joinCode.trim().toUpperCase();
    if (!c) return;
    try {
      await joinRoom({ code: c, playerId, name });
      onEnter(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
    }
  }

  return (
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
      {notFound && <p className="draft-roll__rerolls--low">Room not found.</p>}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <button className="btn-kick" onClick={onCreate}>
          Create room
        </button>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            className="seg"
            placeholder="CODE"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            style={{ padding: "0.5rem", textTransform: "uppercase" }}
          />
          <button onClick={onJoin}>Join</button>
        </div>
      </div>
      {error && <p className="draft-roll__rerolls--low">{error}</p>}
    </section>
  );
}

function Room({
  room,
  playerId,
  onLeave,
}: {
  room: RoomState;
  playerId: string;
  onLeave: () => void;
}) {
  const setPresence = useMutation(api.duel.setPresence);
  const me = room.players.find((p: RoomPlayer) => p.playerId === playerId);
  const mySide = (me?.seat ?? "home") as Side;

  // Heartbeat so the opponent sees presence and disconnects are detectable.
  useEffect(() => {
    const tick = () =>
      setPresence({ roomId: room.roomId, playerId }).catch(() => {});
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [room.roomId, playerId, setPresence]);

  return (
    <>
      <PresenceBar room={room} playerId={playerId} onLeave={onLeave} />
      {room.status === "lobby" && (
        <LobbyRoom room={room} playerId={playerId} />
      )}
      {room.status === "build" && (
        <BuildPhase room={room} playerId={playerId} mySide={mySide} confirmed={!!me?.confirmed} />
      )}
      {(room.status === "reveal" || room.status === "result") && (
        <RevealPhase room={room} playerId={playerId} mySide={mySide} />
      )}
    </>
  );
}

function PresenceBar({
  room,
  playerId,
  onLeave,
}: {
  room: RoomState;
  playerId: string;
  onLeave: () => void;
}) {
  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/duel?code=${room.code}`
      : "";
  return (
    <section className="panel" style={{ padding: "1rem", display: "grid", gap: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="mono">
          Room <strong>{room.code}</strong>
        </span>
        <button onClick={onLeave}>Leave</button>
      </div>
      <ul style={{ display: "flex", gap: "1rem", listStyle: "none", padding: 0, margin: 0 }}>
        {room.players.map((p: RoomPlayer) => (
          <li key={p.playerId} className="mono dim">
            {p.seat === "home" ? "🏠" : "✈️"} {p.name}
            {p.playerId === playerId ? " (you)" : ""} · {p.presence}
            {p.confirmed ? " ✓" : ""}
          </li>
        ))}
      </ul>
      {room.status === "lobby" && (
        <p className="dim mono" style={{ wordBreak: "break-all" }}>
          Invite: {inviteLink}
        </p>
      )}
    </section>
  );
}

function LobbyRoom({ room, playerId }: { room: RoomState; playerId: string }) {
  const startDraw = useMutation(api.duel.startDraw);
  const isHost = room.hostId === playerId;
  const ready = room.players.length >= 2;
  return (
    <section className="hero__cta" style={{ padding: "1.5rem" }}>
      {isHost ? (
        <button className="btn-kick" disabled={!ready} onClick={() => startDraw({ roomId: room.roomId, playerId })}>
          {ready ? "Start draft" : "Waiting for opponent…"}
        </button>
      ) : (
        <p className="dim">Waiting for the host to start…</p>
      )}
    </section>
  );
}

function BuildPhase({
  room,
  playerId,
  mySide,
  confirmed,
}: {
  room: RoomState;
  playerId: string;
  mySide: Side;
  confirmed: boolean;
}) {
  const submitBuild = useMutation(api.duel.submitBuild);
  const seed = room.seed!;
  const options: FormationDefinition[] = useMemo(
    () => (room.formationOptionIds ?? []).map((id) => getFormation(id)),
    [room.formationOptionIds],
  );

  const [formationId, setFormationId] = useState<string | null>(null);
  const [pendingFormationId, setPendingFormationId] = useState<string | null>(null);
  const [buildState, setBuildState] = useState<BuildState | null>(null);
  const actionsRef = useRef<BuildAction[]>([]);
  const submittedRef = useRef(false);

  // Reset everything when a new draw begins (seed changes / rematch).
  useEffect(() => {
    setFormationId(null);
    setPendingFormationId(null);
    setBuildState(null);
    actionsRef.current = [];
    submittedRef.current = false;
  }, [seed]);

  const confirmBuild = useCallback(
    (fid: string) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      submitBuild({
        roomId: room.roomId,
        playerId,
        formationId: fid,
        tactic: "balanced",
        actionsJson: JSON.stringify(actionsRef.current),
      }).catch(() => {
        submittedRef.current = false;
      });
    },
    [room.roomId, playerId, submitBuild],
  );

  // Countdown + auto-submit at the deadline (server also backstops via scheduler).
  const [remaining, setRemaining] = useState<number>(0);
  useEffect(() => {
    const tick = () => {
      const ms = (room.buildDeadline ?? 0) - Date.now();
      setRemaining(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0 && !submittedRef.current) {
        confirmBuild(formationId ?? pendingFormationId ?? options[0]?.id ?? "433-balanced");
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [room.buildDeadline, formationId, pendingFormationId, options, confirmBuild]);

  function onConfirmFormation() {
    if (!pendingFormationId) return;
    setFormationId(pendingFormationId);
    setBuildState(
      initBuildState(CATALOG, seed, mySide, undefined, pendingFormationId),
    );
  }

  if (confirmed || submittedRef.current) {
    return (
      <section className="panel" style={{ padding: "1.5rem", textAlign: "center" }}>
        <h2 className="panel__title">Lineup locked in</h2>
        <p className="dim">Waiting for your opponent… kickoff in {remaining}s.</p>
      </section>
    );
  }

  return (
    <>
      <section className="panel" style={{ padding: "0.75rem", textAlign: "center" }}>
        <span className="mono">⏱ {remaining}s to build</span>
      </section>
      {!formationId || !buildState ? (
        <FormationPicker
          options={options}
          selectedId={pendingFormationId}
          onSelect={setPendingFormationId}
          onConfirm={onConfirmFormation}
        />
      ) : (
        <>
          <BuildPanel
            catalog={CATALOG}
            awayStrength={NEUTRAL_AWAY}
            buildState={buildState}
            onBuildState={setBuildState}
            onAction={(a) => actionsRef.current.push(a)}
          />
          <section className="hero__cta" style={{ padding: "1rem" }}>
            <button className="btn-kick" onClick={() => confirmBuild(formationId)}>
              Confirm lineup
            </button>
          </section>
        </>
      )}
    </>
  );
}

function RevealPhase({
  room,
  playerId,
  mySide,
}: {
  room: RoomState;
  playerId: string;
  mySide: Side;
}) {
  const rematch = useMutation(api.duel.rematch);
  const timeline = room.timeline as MatchTimeline | null;
  if (!timeline) return <p className="dim">Simulating…</p>;

  const isHost = room.hostId === playerId;
  const myResult = room.results.find((r) => r.playerId === playerId);
  const oppName =
    room.players.find((p: RoomPlayer) => p.playerId !== playerId)?.name ?? "Opponent";
  const myName = room.players.find((p: RoomPlayer) => p.playerId === playerId)?.name ?? "You";
  const labels =
    mySide === "home"
      ? { home: myName, away: oppName }
      : { home: oppName, away: myName };

  return (
    <>
      {myResult && (
        <section className="panel" style={{ padding: "1rem", textAlign: "center" }}>
          <h2 className="panel__title">
            {myResult.outcome === "win"
              ? "You win! 🏆"
              : myResult.outcome === "loss"
                ? "Defeat"
                : "Draw"}
          </h2>
          <p className="mono dim">
            {myResult.gf}–{myResult.ga} · chemistry {myResult.chemistryPct}%
          </p>
        </section>
      )}
      <ResultCard
        timeline={timeline}
        homeLabel={labels.home}
        awayLabel={labels.away}
        seed={timeline.seed}
        onAgain={() => {
          if (isHost) rematch({ roomId: room.roomId, playerId });
        }}
      />
      <MatchView key={timeline.seed} timeline={timeline} labels={labels} />
      <StatsPanel timeline={timeline} labels={labels} />
      {!isHost && (
        <p className="dim" style={{ textAlign: "center" }}>
          The host can start a rematch.
        </p>
      )}
    </>
  );
}

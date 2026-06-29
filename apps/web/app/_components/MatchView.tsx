"use client";

/**
 * MatchView — text-only LIVE match presentation.
 *
 * Two modes, both reading the same MatchTimeline:
 *  - "fast":  a curated, event-paced highlight reel. Only high-signal beats
 *             surface (goals, big chances, penalties, cards, subs, period
 *             markers) — the filler (passes, throw-ins, corners, fouls) is
 *             dropped so the feed stays legible and punchy. Each beat lands one
 *             at a time on its own dwell (goals breathe longer), the clock rolls
 *             up to it, and a goal fires a celebration splash. This is also the
 *             screen-reader path via aria-live.
 *  - "ultra": the full result printed instantly.
 *
 * `onComplete` fires once the match (and any shootout) has fully played, so a
 * campaign can advance to the next fixture.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MatchEvent, MatchTimeline, ShootoutKick, Side } from "7a0-engine";
import { useStrings } from "../_i18n/LocaleProvider";
import { Scorebug } from "./Scoreboard";
import { useCountUp, ImpactBurst } from "./motion";
import { useSound } from "../_hooks/useSound";
import type { StringCatalog } from "../_i18n/types";

type Mode = "fast" | "ultra";

const MODE_KEY = "ninety-mode";
const MS_PER_KICK = 950; // one penalty revealed at a time

/** How long each beat lingers before the next one lands (ms). Goals breathe. */
const DWELL: Record<EventKind, number> = {
  goal: 2500,
  penalty: 1900,
  chance: 1450,
  card: 1500,
  sub: 1300,
  period: 1600,
  kickoff: 1100,
};
const FIRST_DELAY = 650;

function loadMode(): Mode {
  if (typeof localStorage === "undefined") return "fast";
  return localStorage.getItem(MODE_KEY) === "ultra" ? "ultra" : "fast";
}

type EventKind = "goal" | "chance" | "card" | "sub" | "penalty" | "period" | "kickoff";

/** A revealed feed beat, pre-formatted from one timeline event. */
interface Entry {
  t: number;
  clockLabel: string;
  emoji: string;
  text: string;
  detail?: string;
  team?: Side;
  kind: EventKind;
  isGoal: boolean;
  /** Running score AFTER this event. */
  home: number;
  away: number;
}

interface Parsed {
  entries: Entry[];
  shootout: { kicks: ShootoutKick[]; winner: Side } | null;
  ftMinute: number;
  hasExtraTime: boolean;
  finalScore: [number, number];
}

/** Clock label: regulation reads "90+n"; once in ET, 91–120 are plain, then "120+n". */
function clockLabel(t: number, inExtraTime: boolean): string {
  if (inExtraTime) return t > 120 ? `120+${t - 120}'` : `${t}'`;
  return t > 90 ? `90+${t - 90}'` : `${t}'`;
}

/** playerId → display name, falling back to "#number" then the raw id. */
function buildNameLookup(lineups: MatchTimeline["lineups"]): (id: string) => string {
  const map = new Map<string, string>();
  for (const side of ["home", "away"] as const) {
    for (const slot of lineups[side]) {
      map.set(slot.playerId, slot.name?.trim() || `#${slot.number}`);
    }
  }
  return (id: string) => map.get(id) ?? id;
}

/** Turn the timeline into ordered, curated feed beats + a held-back shootout. */
function parseTimeline(
  timeline: MatchTimeline,
  labels: Record<Side, string>,
  copy: StringCatalog,
): Parsed {
  const who = buildNameLookup(timeline.lineups);

  const entries: Entry[] = [];
  let shootout: Parsed["shootout"] = null;
  const running: [number, number] = [0, 0];
  let inExtraTime = false;
  let ftMinute = 0;
  let hasExtraTime = false;

  for (const e of timeline.events) {
    if (e.type === "extratime" && e.mark === "start") inExtraTime = true;
    if (e.type === "extratime") hasExtraTime = true;
    if (e.type === "fulltime") ftMinute = Math.max(ftMinute, e.t);

    if (e.type === "shootout") {
      shootout = { kicks: e.kicks, winner: e.winner };
      continue;
    }

    const built = describe(e, labels, who, running, copy);
    if (!built) continue; // filler is dropped — keep the reel punchy
    entries.push({
      t: e.t,
      clockLabel:
        e.type === "halftime" ? "HT" : e.type === "fulltime" ? "FT" : clockLabel(e.t, inExtraTime),
      ...built,
      home: running[0],
      away: running[1],
    });
  }

  return {
    entries,
    shootout,
    ftMinute: ftMinute || (timeline.events.at(-1)?.t ?? 90),
    hasExtraTime,
    finalScore: timeline.result.score,
  };
}

type Built = Omit<Entry, "t" | "clockLabel" | "home" | "away">;

/** One curated beat for an event, or `null` to drop it from the reel. The
 * running score is mutated for goals. */
function describe(
  e: MatchEvent,
  labels: Record<Side, string>,
  who: (id: string) => string,
  running: [number, number],
  copy: StringCatalog,
): Built | null {
  const S = copy;
  switch (e.type) {
    case "kickoff":
      return { emoji: "🟢", kind: "kickoff", text: S.events.kickoff, isGoal: false };
    case "goal": {
      if (e.team === "home") running[0]++;
      else running[1]++;
      const assist = e.assistId ? `${S.events.assist} ${who(e.assistId)}` : undefined;
      return {
        emoji: "⚽",
        kind: "goal",
        team: e.team,
        text: who(e.scorerId),
        detail: [labels[e.team], assist].filter(Boolean).join(" · "),
        isGoal: true,
      };
    }
    case "shot": {
      // Only the moments that raise the pulse — saves and woodwork. Off-target
      // and tap-ins-that-become-goals are dropped (goals are their own event).
      if (e.outcome === "saved")
        return { emoji: "🧤", kind: "chance", team: e.team, text: `${labels[e.team]} — ${S.events.saved}`, isGoal: false };
      if (e.outcome === "post")
        return { emoji: "🪵", kind: "chance", team: e.team, text: `${labels[e.team]} — ${S.events.post}`, isGoal: false };
      return null;
    }
    case "penalty": {
      const text =
        e.outcome === "goal"
          ? S.events.penScoredLive
          : e.outcome === "saved"
            ? S.events.penSavedLive
            : S.events.penMissedLive;
      return {
        emoji: e.outcome === "goal" ? "🎯" : "🚫",
        kind: "penalty",
        team: e.team,
        text: `${labels[e.team]} — ${text}`,
        isGoal: false,
      };
    }
    case "card": {
      const label =
        e.card === "yellow"
          ? S.events.yellowCard
          : e.secondYellow
            ? S.events.secondYellow
            : S.events.redCard;
      return {
        emoji: e.card === "yellow" ? "🟨" : e.secondYellow ? "🟨🟥" : "🟥",
        kind: "card",
        team: e.team,
        text: `${who(e.playerId)} — ${label}`,
        detail: labels[e.team],
        isGoal: false,
      };
    }
    case "substitution":
      return {
        emoji: "🔄",
        kind: "sub",
        team: e.team,
        text: `${who(e.outId)} ↦ #${e.inNumber}`,
        detail: labels[e.team],
        isGoal: false,
      };
    case "halftime":
      return { emoji: "⏸️", kind: "period", text: S.events.halftime, isGoal: false };
    case "extratime":
      return {
        emoji: "⏱️",
        kind: "period",
        text:
          e.mark === "start"
            ? S.events.extraTimeStart
            : e.mark === "ht"
              ? S.events.extraTimeHt
              : S.events.extraTimeEnd,
        isGoal: false,
      };
    case "fulltime":
      return { emoji: "🏁", kind: "period", text: S.full, isGoal: false };
    // Filler — dropped from the reel so the feed stays legible.
    case "corner":
    case "freekick":
    case "foul":
    case "offside":
    case "throwin":
    case "possession":
      return null;
    case "shootout":
      return null; // handled separately
  }
}

type Phase = "playing" | "shootout" | "done";

export function MatchView({
  timeline,
  labels,
  header,
  onComplete,
  onDone,
}: {
  timeline: MatchTimeline;
  labels?: { home: string; away: string };
  /** Optional chip above the clock, e.g. "Group game 2 of 3". */
  header?: string;
  /** Fires once when the match (and any shootout) has fully played. */
  onComplete?: () => void;
  /**
   * Fires when the match reaches its final state (`phase === "done"`), whether
   * by the reel finishing, a skip-to-result, or Ultra Fast. Lets the parent
   * hold back end-of-match content (stats, results) until the match is over,
   * so nothing is spoiled while the ticker is still playing.
   */
  onDone?: () => void;
}) {
  const S = useStrings();
  const lab = labels ?? { home: "Home", away: "Away" };
  const parsed = useMemo(() => parseTimeline(timeline, lab, S), [timeline, lab.home, lab.away, S]);

  const { play } = useSound();
  const [mode, setMode] = useState<Mode>("fast");
  /** Playback speed for the Fast reel — never changes the outcome. */
  const [speed, setSpeed] = useState<1 | 2>(1);
  /** Number of beats revealed so far (0…entries.length). */
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [kicksShown, setKicksShown] = useState(0);
  const [running, setRunning] = useState(false);
  const [splash, setSplash] = useState<
    { key: number; team: Side; score: [number, number]; scorer: string; detail?: string } | null
  >(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // Sync persisted mode on mount (client-only, avoids hydration mismatch).
  useEffect(() => setMode(loadMode()), []);

  // Notify the parent the moment the match settles, so it can reveal held-back
  // end-of-match content (stats, results) only now — never mid-ticker.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    if (phase === "done") onDoneRef.current?.();
  }, [phase]);

  const reset = useCallback((nextRunning: boolean) => {
    setIdx(0);
    setKicksShown(0);
    setPhase("playing");
    setSplash(null);
    setRunning(nextRunning);
  }, []);

  const finishInstantly = useCallback(() => {
    setIdx(parsed.entries.length);
    setKicksShown(parsed.shootout?.kicks.length ?? 0);
    setPhase("done");
    setSplash(null);
    setRunning(false);
  }, [parsed]);

  // Re-initialise whenever the match or mode changes.
  useEffect(() => {
    if (mode === "ultra") finishInstantly();
    else reset(true);
  }, [parsed, mode, reset, finishInstantly]);

  // The reel: reveal one curated beat at a time, dwelling on the one just shown
  // (so a goal lingers before the next beat lands).
  useEffect(() => {
    if (mode !== "fast" || phase !== "playing" || !running) return;
    if (idx >= parsed.entries.length) {
      setPhase(parsed.shootout ? "shootout" : "done");
      return;
    }
    const justShown = idx > 0 ? parsed.entries[idx - 1] : null;
    const wait = (justShown ? DWELL[justShown.kind] : FIRST_DELAY) / speed;
    const id = setTimeout(() => setIdx((i) => i + 1), wait);
    return () => clearTimeout(id);
  }, [mode, phase, running, idx, parsed, speed]);

  // The shootout, one kick at a time.
  useEffect(() => {
    if (mode !== "fast" || phase !== "shootout" || !running || !parsed.shootout) return;
    const total = parsed.shootout.kicks.length;
    const id = setInterval(() => {
      setKicksShown((k) => {
        if (k >= total) {
          setPhase("done");
          return k;
        }
        return k + 1;
      });
    }, MS_PER_KICK / speed);
    return () => clearInterval(id);
  }, [mode, phase, running, parsed, speed]);

  // Fire a celebration splash the moment a goal beat is revealed.
  useEffect(() => {
    if (mode !== "fast") return;
    const last = idx > 0 ? parsed.entries[idx - 1] : null;
    if (!last?.isGoal || !last.team) return;
    play("goal");
    setSplash({
      key: idx,
      team: last.team,
      score: [last.home, last.away],
      scorer: last.text,
      detail: last.detail,
    });
    const id = setTimeout(() => setSplash(null), 1700 / speed);
    return () => clearTimeout(id);
  }, [idx, mode, parsed, speed, play]);

  // Auto-scroll the feed as new beats land.
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [idx, kicksShown]);

  function changeMode(next: Mode) {
    setMode(next);
    if (typeof localStorage !== "undefined") localStorage.setItem(MODE_KEY, next);
  }

  function togglePlay() {
    if (running) {
      setRunning(false);
    } else {
      if (phase === "done") reset(true);
      else setRunning(true);
    }
  }

  const shown = parsed.entries.slice(0, idx);
  const last = shown[shown.length - 1];
  const score: [number, number] = last ? [last.home, last.away] : [0, 0];

  const targetMinute = last?.t ?? 0;
  const inET = parsed.hasExtraTime && targetMinute > 90;
  const clockActive = mode === "fast" && phase === "playing";
  const minute = useCountUp(targetMinute, { active: clockActive });

  const periodLabel =
    phase === "shootout"
      ? S.events.shootout
      : phase === "done"
        ? S.full
        : inET
          ? S.events.extraTimeStart
          : minute <= 45
            ? S.period.first
            : S.period.second;

  const pensTally = useMemo<[number, number] | undefined>(() => {
    if (!parsed.shootout || kicksShown === 0) return undefined;
    const t: [number, number] = [0, 0];
    for (const k of parsed.shootout.kicks.slice(0, kicksShown)) {
      if (k.scored) t[k.team === "home" ? 0 : 1]++;
    }
    return t;
  }, [parsed.shootout, kicksShown]);

  const live = mode === "fast" && running && phase !== "done";
  const bigClock =
    phase === "shootout" ? "PENS" : phase === "done" ? "FT" : clockLabel(minute, inET);
  const progress = phase === "done" ? 100 : Math.min(100, (minute / parsed.ftMinute) * 100);

  return (
    <section className="panel matchview">
      <div className="feed__bar">
        <div>
          <div className="eyebrow">{header ?? S.matchKicker}</div>
          <h2 className="panel__title">{S.matchTitle}</h2>
        </div>
        <div className="row" style={{ gap: "0.5rem" }}>
          <span className="status">
            <span className="status__dot" data-live={live ? "true" : "false"} aria-hidden />
            {live ? S.live : phase === "done" ? S.full : S.mode.fast}
          </span>
          {(["fast", "ultra"] as const).map((m) => (
            <button key={m} aria-pressed={mode === m} onClick={() => changeMode(m)}>
              {S.mode[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="matchclock" aria-hidden>
        <span className="matchclock__time" data-live={live ? "true" : "false"}>
          {bigClock}
        </span>
        <span className="matchclock__period">{periodLabel}</span>
        <div className="matchclock__progress">
          <span className="matchclock__progressfill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="scorebug-wrap" key={`${score[0]}-${score[1]}`}>
        <Scorebug
          homeLabel={lab.home}
          awayLabel={lab.away}
          homeScore={score[0]}
          awayScore={score[1]}
          pens={phase === "done" ? (timeline.result.penalties ?? pensTally) : pensTally}
        />
      </div>

      <div className="feed__screen" ref={feedRef} aria-live="polite" aria-label="Match commentary">
        {shown.length === 0 && phase === "playing" && (
          <div className="feed__waiting">{S.events.kickoff}…</div>
        )}

        {shown.map((e, i) => (
          <div
            key={i}
            className={`tick tick--${e.kind}`}
            data-team={e.team ?? "neutral"}
          >
            <span className="tick__icon" aria-hidden>
              {e.emoji}
            </span>
            <span className="tick__time mono">{e.clockLabel}</span>
            <span className="tick__body">
              {e.kind === "goal" ? (
                <>
                  <span className="tick__goal">{S.events.goal}</span>
                  <span className="tick__text">
                    {e.text} {e.detail && <span className="tick__detail">{e.detail}</span>}
                  </span>
                  <span className="tick__score mono">
                    {e.home}–{e.away}
                  </span>
                </>
              ) : (
                <span className="tick__text">
                  {e.text}
                  {e.detail && <span className="tick__detail"> {e.detail}</span>}
                </span>
              )}
            </span>
          </div>
        ))}

        {parsed.shootout && kicksShown > 0 && (
          <div className="shootout">
            <div className="shootout__head">🥅 {S.events.shootout}</div>
            {parsed.shootout.kicks.slice(0, kicksShown).map((k, i) => (
              <div key={i} className="shootout__kick" data-team={k.team}>
                <span className="shootout__mark" aria-hidden>
                  {k.scored ? "✅" : "❌"}
                </span>
                <span className="shootout__team">{lab[k.team]}</span>
                <span className="shootout__outcome mono">
                  {k.scored ? S.events.penScored : S.events.penMissed}
                </span>
              </div>
            ))}
            {kicksShown >= parsed.shootout.kicks.length && (
              <div className="shootout__result">
                🏆 {lab[parsed.shootout.winner]} {S.events.penWin}
              </div>
            )}
          </div>
        )}
      </div>

      <ImpactBurst
        trigger={splash ? splash.key : null}
        tone={splash?.team === "away" ? "away" : "home"}
        sparks={10}
      />

      {splash && (
        <div className="goal-splash" key={splash.key} data-team={splash.team} aria-hidden>
          <span className="goal-splash__ball">⚽</span>
          <span className="goal-splash__word">{S.events.goal}</span>
          <span className="goal-splash__score mono">
            {splash.score[0]}–{splash.score[1]}
          </span>
        </div>
      )}

      {splash && (
        <div className="lower-third" key={`lt-${splash.key}`} data-team={splash.team} aria-hidden>
          <span className="lower-third__tag">{S.events.goal}</span>
          <span className="lower-third__name">{splash.scorer}</span>
          {splash.detail && <span className="lower-third__detail">{splash.detail}</span>}
        </div>
      )}

      <div className="feed__controls">
        {mode === "fast" && (
          <>
            <button onClick={togglePlay}>
              {running ? `⏸ ${S.pause}` : phase === "done" ? `↺ ${S.restart}` : `▶ ${S.play}`}
            </button>
            <button onClick={() => reset(true)}>↺ {S.restart}</button>
            <button
              onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
              aria-pressed={speed === 2}
              aria-label={S.speed}
              title={S.speed}
            >
              {speed}×
            </button>
            <button onClick={finishInstantly} disabled={phase === "done"}>
              ⏭ {S.skip}
            </button>
          </>
        )}
        {onComplete && phase === "done" && (
          <button className="btn-kick" onClick={onComplete}>
            {S.nextMatch} →
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * Shareable highlights (MVP M5) — a compact, self-contained encoding of a
 * match's *goals* so a link can replay them as text commentary, with a share
 * card, and **no login or catalog** needed to view (MVP §4.3, PRD §8.3).
 *
 * The `MatchTimeline` is already fully self-describing (player names ride on
 * `LineupSlot.name`), so a highlight is *derived from* a timeline and carries
 * everything it needs inline. That means:
 *  - exact reproduction, with no dependency on the catalog version, and
 *  - one codec that works for solo and online matches alike.
 *
 * `highlightToTimeline` rebuilds a minimal `MatchTimeline` so existing
 * presentation (the `MatchView` ticker, `toFastText`) can be reused unchanged.
 */

import { EXTRA_TIME_END, REGULATION_MINUTES } from "./constants.js";
import type {
  LineupSlot,
  MatchEvent,
  MatchScenario,
  MatchTimeline,
  ShootoutKick,
  Side,
} from "./types.js";

/** Margin (goals) at or above which a win counts as a thrashing. Tunable. */
export const ESMAGADOR_MARGIN = 5;

/** Team index in the compact payload: 0 = home, 1 = away. */
type TeamIdx = 0 | 1;

/** One goal: minute, side, scorer name, optional assist name. */
export type HighlightGoal =
  | [t: number, team: TeamIdx, scorer: string]
  | [t: number, team: TeamIdx, scorer: string, assist: string];

/** One shootout kick: side, scored (1) or missed (0). */
export type HighlightKick = [team: TeamIdx, scored: 0 | 1];

/**
 * Compact, versioned highlight payload. Short keys keep the encoded link small
 * — a goals-only payload is tiny, so no compression is needed.
 */
export interface HighlightPayload {
  /** Schema version; bump on any breaking change. */
  v: 1;
  /** Scenario: [team, cup]. */
  scn: [team: string, cup: number];
  /** Final score [home, away]. */
  sc: [number, number];
  /** Penalty shootout tally [home, away], if the match went to penalties. */
  pe?: [number, number];
  /** 1 if the match went to extra time (clock labelling). */
  et?: 1;
  /** Display labels [home, away]. */
  lb: [home: string, away: string];
  /** Away tag, e.g. "'2018". */
  tg?: string;
  /** Goals in order. */
  g: HighlightGoal[];
  /** Shootout kicks in order (faithful shootout replay), if any. */
  so?: HighlightKick[];
}

export interface ToHighlightOptions {
  labels: Record<Side, string>;
  awayTag?: string;
}

const sideIndex = (side: Side): TeamIdx => (side === "home" ? 0 : 1);
const indexSide = (i: TeamIdx): Side => (i === 0 ? "home" : "away");

/** playerId → display name, falling back to "#number" then the raw id. */
function nameLookup(lineups: Record<Side, LineupSlot[]>): (id: string) => string {
  const map = new Map<string, string>();
  for (const side of ["home", "away"] as const) {
    for (const slot of lineups[side]) {
      map.set(slot.playerId, slot.name?.trim() || `#${slot.number}`);
    }
  }
  return (id) => map.get(id) ?? id;
}

/** Derive a compact, self-contained highlight from a full match timeline. */
export function toHighlight(
  timeline: MatchTimeline,
  options: ToHighlightOptions,
): HighlightPayload {
  const who = nameLookup(timeline.lineups);

  const goals: HighlightGoal[] = [];
  let kicks: HighlightKick[] | undefined;
  let extraTime = false;

  for (const e of timeline.events) {
    if (e.type === "extratime") extraTime = true;
    else if (e.type === "goal") {
      const team = sideIndex(e.team);
      const scorer = who(e.scorerId);
      goals.push(e.assistId ? [e.t, team, scorer, who(e.assistId)] : [e.t, team, scorer]);
    } else if (e.type === "shootout") {
      kicks = e.kicks.map((k): HighlightKick => [sideIndex(k.team), k.scored ? 1 : 0]);
    }
  }

  const payload: HighlightPayload = {
    v: 1,
    scn: [timeline.scenario.team, timeline.scenario.cup],
    sc: [timeline.result.score[0], timeline.result.score[1]],
    lb: [options.labels.home, options.labels.away],
    g: goals,
  };
  if (timeline.result.penalties) {
    payload.pe = [timeline.result.penalties[0], timeline.result.penalties[1]];
  }
  if (extraTime) payload.et = 1;
  if (options.awayTag) payload.tg = options.awayTag;
  if (kicks && kicks.length) payload.so = kicks;
  return payload;
}

/**
 * Rebuild a minimal `MatchTimeline` from a highlight so existing presentation
 * (the `MatchView` ticker, `toFastText`) can replay it unchanged. Only the
 * goal-relevant events are reconstructed; the ticker drops filler anyway.
 *
 * Scorer/assist names are stored as the slot id *and* name, so the consumers'
 * id → name lookup resolves to the real player without a catalog.
 */
export function highlightToTimeline(payload: HighlightPayload): MatchTimeline {
  const scenario: MatchScenario = { team: payload.scn[0], cup: payload.scn[1] };
  const extraTime = payload.et === 1;
  const ftMinute = extraTime ? EXTRA_TIME_END : REGULATION_MINUTES;

  // Synthetic lineups: one slot per distinct person who scored or assisted, so
  // the consumers' name lookup (playerId → name) resolves. Split by side only
  // to satisfy the schema; the lookup is global.
  const slots: Record<Side, Map<string, LineupSlot>> = {
    home: new Map(),
    away: new Map(),
  };
  const addPerson = (side: Side, name: string) => {
    const bucket = slots[side];
    if (!bucket.has(name)) {
      bucket.set(name, {
        playerId: name,
        name,
        number: bucket.size + 1,
        position: "",
        anchor: { x: 0.5, y: 0.5 },
      });
    }
  };

  const events: MatchEvent[] = [{ t: 0, type: "kickoff", team: "home" }];
  if (extraTime) events.push({ t: REGULATION_MINUTES, type: "extratime", mark: "start" });

  for (const goal of payload.g) {
    const [t, teamIdx, scorer, assist] = goal;
    const team = indexSide(teamIdx);
    addPerson(team, scorer);
    if (assist) addPerson(team, assist);
    events.push({
      t,
      type: "goal",
      team,
      scorerId: scorer,
      ...(assist ? { assistId: assist } : {}),
      from: { x: 0.5, y: 0.5 },
    });
  }

  events.push({ t: ftMinute, type: "fulltime", score: [payload.sc[0], payload.sc[1]] });

  if (payload.so && payload.so.length) {
    const kicks: ShootoutKick[] = payload.so.map(([teamIdx, scored]) => ({
      team: indexSide(teamIdx),
      scored: scored === 1,
    }));
    const tally = payload.pe ?? shootoutTally(kicks);
    events.push({
      t: ftMinute,
      type: "shootout",
      kicks,
      winner: tally[0] >= tally[1] ? "home" : "away",
    });
  }

  // Keep events ordered by minute (goals may interleave around markers).
  events.sort((a, b) => a.t - b.t);

  return {
    seed: "highlight",
    scenario,
    lineups: {
      home: [...slots.home.values()],
      away: [...slots.away.values()],
    },
    result: {
      score: [payload.sc[0], payload.sc[1]],
      ...(payload.pe ? { penalties: [payload.pe[0], payload.pe[1]] } : {}),
    },
    events,
    durationMs: 0,
  };
}

function shootoutTally(kicks: ShootoutKick[]): [number, number] {
  const t: [number, number] = [0, 0];
  for (const k of kicks) if (k.scored) t[k.team === "home" ? 0 : 1]++;
  return t;
}

export interface HighlightBadge {
  id: "seven-nil" | "clean-sheet" | "hat-trick" | "esmagador";
  label: string;
}

/** Single-match badges derivable from a highlight (no campaign context). */
export function highlightBadges(payload: HighlightPayload): HighlightBadge[] {
  const [h, a] = payload.sc;
  const badges: HighlightBadge[] = [];

  if ((h === 7 && a === 0) || (a === 7 && h === 0)) {
    badges.push({ id: "seven-nil", label: "7–0" });
  }

  const winnerCleanSheet = (h > a && a === 0) || (a > h && h === 0);
  // Avoid duplicating the 7–0 badge with a generic clean sheet.
  if (winnerCleanSheet && !(h === 7 || a === 7)) {
    badges.push({ id: "clean-sheet", label: "Clean sheet" });
  }

  const counts = new Map<string, number>();
  for (const goal of payload.g) {
    const scorer = goal[2];
    counts.set(scorer, (counts.get(scorer) ?? 0) + 1);
  }
  for (const [scorer, n] of counts) {
    if (n >= 3) badges.push({ id: "hat-trick", label: `Hat-trick · ${scorer}` });
  }

  if (Math.abs(h - a) >= ESMAGADOR_MARGIN) {
    badges.push({ id: "esmagador", label: "Esmagador" });
  }

  return badges;
}

/** Goals-only commentary lines (no-JS / OG alt text / CLI / main-app reuse). */
export function toHighlightText(payload: HighlightPayload): string[] {
  const labels: [string, string] = payload.lb;
  const running: [number, number] = [0, 0];
  const lines: string[] = [];
  for (const goal of payload.g) {
    const [t, team, scorer, assist] = goal;
    running[team]++;
    const clock = t > 90 ? `90+${t - 90}'` : `${t}'`;
    const assistText = assist ? ` (assist ${assist})` : "";
    lines.push(
      `${clock}  GOAL! ${labels[team]} — ${scorer}${assistText}  —  ${running[0]}–${running[1]}`,
    );
  }
  lines.push(`FT  ${labels[0]} ${payload.sc[0]}–${payload.sc[1]} ${labels[1]}`);
  if (payload.pe) {
    lines.push(`Penalties: ${labels[0]} ${payload.pe[0]}–${payload.pe[1]} ${labels[1]}`);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// URL-safe codec — isomorphic base64url (works in Node and the browser).
// ---------------------------------------------------------------------------

function utf8ToBase64(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "utf8").toString("base64");
  // Browser: encode UTF-8 bytes, then base64.
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}

function base64ToUtf8(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "base64").toString("utf8");
  const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Encode a payload as a URL-safe string (`[A-Za-z0-9_-]`, no padding). */
export function encodeHighlight(payload: HighlightPayload): string {
  return utf8ToBase64(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Decode a URL-safe highlight code. Throws on a malformed or unknown payload. */
export function decodeHighlight(code: string): HighlightPayload {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const json = base64ToUtf8(b64);
  const payload = JSON.parse(json) as HighlightPayload;
  if (payload?.v !== 1 || !Array.isArray(payload.g) || !Array.isArray(payload.sc)) {
    throw new Error("Unsupported or malformed highlight payload");
  }
  return payload;
}

"use client";

import { useMemo } from "react";
import type { TournamentViewState } from "./TournamentReveal";
import { useStrings } from "../_i18n/LocaleProvider";
import type { StringCatalog } from "../_i18n/types";

function slotName(
  participants: TournamentViewState["participants"],
  slot: number,
  S: StringCatalog,
): string {
  return participants.find((p) => p.slot === slot)?.name ?? S.tournament.slotName(slot);
}

function isWinner(
  match: TournamentViewState["matches"][number],
  slot: number,
): boolean {
  return match.winnerSlot === slot;
}

function onMyPath(
  state: TournamentViewState,
  mySlot: number | undefined,
  slot: number,
): boolean {
  if (mySlot === undefined) return false;
  if (slot === mySlot) return true;
  if (state.championSlot === mySlot) {
    const played = state.matches.some(
      (m) =>
        (m.homeSlot === mySlot || m.awaySlot === mySlot) &&
        (m.homeSlot === slot || m.awaySlot === slot),
    );
    return played;
  }
  return false;
}

interface BracketTeamRow {
  slot: number;
  name: string;
  points: number;
  gd: number;
  rank: number;
  advances: boolean;
  isMe: boolean;
  onPath: boolean;
}

function buildGroupRows(
  state: TournamentViewState,
  groupIndex: number,
  mySlot: number | undefined,
  S: StringCatalog,
): BracketTeamRow[] {
  const table = state.standings.find((g) => g.groupIndex === groupIndex)?.table ?? [];
  return table.map((row, i) => ({
    slot: row.slot,
    name: slotName(state.participants, row.slot, S),
    points: row.points,
    gd: row.gd,
    rank: i + 1,
    advances: i < 2,
    isMe: row.slot === mySlot,
    onPath: onMyPath(state, mySlot, row.slot),
  }));
}

export function TournamentBracket({
  state,
  mySlot,
  expandedIndex,
  onToggleMatch,
}: {
  state: TournamentViewState;
  mySlot?: number;
  expandedIndex: number | null;
  onToggleMatch: (index: number | null) => void;
}) {
  const S = useStrings();
  const groupA = useMemo(() => buildGroupRows(state, 0, mySlot, S), [state, mySlot, S]);
  const groupB = useMemo(() => buildGroupRows(state, 1, mySlot, S), [state, mySlot, S]);

  const semis = state.matches.filter((m) => m.stage === "semi");
  const sf1 = semis[0];
  const sf2 = semis[1];
  const final = state.matches.find((m) => m.stage === "final");

  const sf1Index = sf1 ? state.matches.indexOf(sf1) : -1;
  const sf2Index = sf2 ? state.matches.indexOf(sf2) : -1;
  const finalIndex = final ? state.matches.indexOf(final) : -1;

  return (
    <section className="bracket panel" aria-label={S.tournament.bracketAria}>
      <header className="bracket__head">
        <p className="panel__kicker">{S.tournament.knockout}</p>
        <h3 className="panel__title">{S.tournament.trajectories}</h3>
      </header>

      <div className="bracket-scroll">
        <div className="bracket-board">
          <svg className="bracket-lines" viewBox="0 0 920 360" preserveAspectRatio="none" aria-hidden>
            {/* Group A top two → semis (cross-bracket) */}
            <path d="M 168 52 C 220 52, 248 88, 288 96" className="bracket-line" />
            <path d="M 168 132 C 220 132, 248 168, 288 264" className="bracket-line" />
            {/* Group B top two → semis */}
            <path d="M 752 52 C 700 52, 672 168, 632 264" className="bracket-line" />
            <path d="M 752 132 C 700 132, 672 88, 632 96" className="bracket-line" />
            {/* Semis → final */}
            <path d="M 432 96 C 468 96, 492 128, 520 156" className="bracket-line" />
            <path d="M 432 264 C 468 264, 492 212, 520 180" className="bracket-line" />
            <path d="M 632 96 C 596 96, 572 128, 544 156" className="bracket-line" />
            <path d="M 632 264 C 596 264, 572 212, 544 180" className="bracket-line" />
          </svg>

          <div className="bracket-grid">
            <div className="bracket-col bracket-col--group">
              <h4 className="bracket-col__label">{S.tournament.groupA}</h4>
              <ul className="bracket-teams">
                {groupA.map((team) => (
                  <li key={team.slot}>
                    <GroupTeamRow team={team} S={S} side="left" />
                  </li>
                ))}
              </ul>
            </div>

            <div className="bracket-col bracket-col--semi bracket-col--semi-top">
              {sf1 && (
                <MatchNode
                  match={sf1}
                  matchIndex={sf1Index}
                  state={state}
                  mySlot={mySlot}
                  S={S}
                  label={S.tournament.semifinalN(1)}
                  expanded={expandedIndex === sf1Index}
                  onToggle={() => onToggleMatch(expandedIndex === sf1Index ? null : sf1Index)}
                />
              )}
            </div>

            <div className="bracket-col bracket-col--final">
              {final && (
                <MatchNode
                  match={final}
                  matchIndex={finalIndex}
                  state={state}
                  mySlot={mySlot}
                  S={S}
                  label={S.tournament.final}
                  expanded={expandedIndex === finalIndex}
                  onToggle={() => onToggleMatch(expandedIndex === finalIndex ? null : finalIndex)}
                  champion={state.championSlot}
                />
              )}
            </div>

            <div className="bracket-col bracket-col--semi bracket-col--semi-bottom">
              {sf2 && (
                <MatchNode
                  match={sf2}
                  matchIndex={sf2Index}
                  state={state}
                  mySlot={mySlot}
                  S={S}
                  label={S.tournament.semifinalN(2)}
                  expanded={expandedIndex === sf2Index}
                  onToggle={() => onToggleMatch(expandedIndex === sf2Index ? null : sf2Index)}
                />
              )}
            </div>

            <div className="bracket-col bracket-col--group">
              <h4 className="bracket-col__label">{S.tournament.groupB}</h4>
              <ul className="bracket-teams">
                {groupB.map((team) => (
                  <li key={team.slot}>
                    <GroupTeamRow team={team} S={S} side="right" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <p className="bracket__hint dim">{S.tournament.bracketHint}</p>
    </section>
  );
}

function GroupTeamRow({
  team,
  S,
  side,
}: {
  team: BracketTeamRow;
  S: StringCatalog;
  side: "left" | "right";
}) {
  const classes = [
    "bracket-team",
    team.advances ? "bracket-team--advances" : "bracket-team--out",
    team.isMe ? "bracket-team--me" : "",
    team.onPath ? "bracket-team--path" : "",
    side === "right" ? "bracket-team--right" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <span className="bracket-team__rank mono">{team.rank}</span>
      <span className="bracket-team__name">{team.name}</span>
      <span className="bracket-team__meta mono">
        {team.points} {S.tournament.pts}
        <span aria-hidden> · </span>
        {team.gd > 0 ? "+" : ""}
        {team.gd} {S.tournament.gd}
      </span>
      {team.advances ? (
        <span className="bracket-team__badge">{S.tournament.advances}</span>
      ) : (
        <span className="bracket-team__badge bracket-team__badge--out">{S.tournament.out}</span>
      )}
    </div>
  );
}

function MatchNode({
  match,
  matchIndex,
  state,
  mySlot,
  S,
  label,
  expanded,
  onToggle,
  champion,
}: {
  match: TournamentViewState["matches"][number];
  matchIndex: number;
  state: TournamentViewState;
  mySlot?: number;
  S: StringCatalog;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  champion?: number;
}) {
  const home = slotName(state.participants, match.homeSlot, S);
  const away = slotName(state.participants, match.awaySlot, S);
  const mine =
    mySlot !== undefined && (match.homeSlot === mySlot || match.awaySlot === mySlot);
  const isFinal = match.stage === "final";

  return (
    <button
      type="button"
      className={[
        "bracket-match",
        mine ? "bracket-match--mine" : "",
        isFinal ? "bracket-match--final" : "",
        expanded ? "bracket-match--open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={expanded ? `fixture-${matchIndex}` : undefined}
    >
      <span className="bracket-match__stage">{label}</span>
      <span
        className={[
          "bracket-match__team",
          isWinner(match, match.homeSlot) ? "bracket-match__team--win" : "",
          match.homeSlot === champion ? "bracket-match__team--champion" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {home}
      </span>
      <span className="bracket-match__score mono" aria-label={S.scoreboard.liveAria(home, match.gf, away, match.ga)}>
        {match.gf}–{match.ga}
      </span>
      <span
        className={[
          "bracket-match__team",
          isWinner(match, match.awaySlot) ? "bracket-match__team--win" : "",
          match.awaySlot === champion ? "bracket-match__team--champion" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {away}
      </span>
    </button>
  );
}

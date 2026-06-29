"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MatchTimeline, ResolvedTournament } from "7a0-engine";
import { MatchView } from "./MatchView";
import { StatsPanel } from "./StatsPanel";
import { ShareHighlight } from "./ShareHighlight";
import { STRINGS as S } from "../_data/strings";

export type TournamentViewState = ResolvedTournament & {
  /** Optional Convex id — offline runs omit this. */
  tournamentId?: string;
};

function slotName(participants: TournamentViewState["participants"], slot: number): string {
  return participants.find((p) => p.slot === slot)?.name ?? `Slot ${slot}`;
}

function myJourney(state: TournamentViewState, mySlot: number): string {
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

export function TournamentReveal({
  state,
  mySlot,
  onPlayAgain,
  playAgainLabel = "Search again with a new squad",
  myElo,
  myEloDelta,
}: {
  state: TournamentViewState;
  /** The human player's tournament slot (slot 0+ after shuffle). */
  mySlot: number | undefined;
  onPlayAgain: () => void;
  playAgainLabel?: string;
  /** New persistent rating after this tournament (online only). */
  myElo?: number;
  /** Rating change earned in this tournament (online only). */
  myEloDelta?: number;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [campaignDone, setCampaignDone] = useState(false);
  const handleCampaignDone = useCallback(() => setCampaignDone(true), []);

  const myMatches = useMemo(
    () =>
      state.matches.filter(
        (m) => mySlot !== undefined && (m.homeSlot === mySlot || m.awaySlot === mySlot),
      ),
    [state.matches, mySlot],
  );

  const semis = state.matches.filter((m) => m.stage === "semi");
  const final = state.matches.find((m) => m.stage === "final");

  let groupNo = 0;
  const campaign: CampaignFixture[] = myMatches.map((m) => {
    const header =
      m.stage === "group"
        ? S.campaign.groupGame(++groupNo, 3)
        : m.stage === "semi"
          ? S.campaign.semifinal
          : S.campaign.final;
    return {
      timeline: m.timeline,
      home: slotName(state.participants, m.homeSlot),
      away: slotName(state.participants, m.awaySlot),
      header,
    };
  });

  const showResults = campaignDone || campaign.length === 0;

  return (
    <>
      {campaign.length > 0 && (
        <CampaignPlayer sequence={campaign} onAllDone={handleCampaignDone} />
      )}

      {showResults && (
        <>
          <section className="panel" style={{ padding: "1rem", textAlign: "center" }}>
            <h2 className="panel__title">
              {mySlot !== undefined ? myJourney(state, mySlot) : "Tournament complete"}
            </h2>
            <p className="mono dim">
              Champion: {slotName(state.participants, state.championSlot)}
            </p>
            {myElo !== undefined && (
              <p className="mono" style={{ marginTop: "0.5rem" }}>
                {S.leaderboard.elo}: <strong>{myElo}</strong>
                {myEloDelta !== undefined && (
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      color: myEloDelta >= 0 ? "var(--lime, #9be15d)" : "var(--coral, #ff6b6b)",
                    }}
                  >
                    {S.leaderboard.delta(myEloDelta)}
                  </span>
                )}
              </p>
            )}
          </section>

          <section
            className="panel"
            style={{ padding: "1rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}
          >
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
                        type="button"
                        className="mono"
                        onClick={() => setExpanded(expanded === key ? null : key)}
                        style={{ width: "100%", textAlign: "left" }}
                      >
                        {home} {m.gf}–{m.ga} {away}
                      </button>
                      {expanded === key && (
                        <FixtureDetail timeline={m.timeline} home={home} away={away} />
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
                    type="button"
                    className="mono"
                    onClick={() => setExpanded(expanded === key ? null : key)}
                    style={{ width: "100%", textAlign: "left" }}
                  >
                    Semifinal {i + 1}: {home} {m.gf}–{m.ga} {away}
                  </button>
                  {expanded === key && (
                    <FixtureDetail timeline={m.timeline} home={home} away={away} />
                  )}
                </div>
              );
            })}
            {final && (
              <div>
                <button
                  type="button"
                  className="mono"
                  onClick={() =>
                    setExpanded(
                      expanded === state.matches.indexOf(final)
                        ? null
                        : state.matches.indexOf(final),
                    )
                  }
                  style={{ width: "100%", textAlign: "left" }}
                >
                  Final: {slotName(state.participants, final.homeSlot)} {final.gf}–{final.ga}{" "}
                  {slotName(state.participants, final.awaySlot)}
                </button>
                {expanded === state.matches.indexOf(final) && (
                  <FixtureDetail
                    timeline={final.timeline}
                    home={slotName(state.participants, final.homeSlot)}
                    away={slotName(state.participants, final.awaySlot)}
                  />
                )}
              </div>
            )}
          </section>
        </>
      )}

      <section className="hero__cta" style={{ padding: "1rem", textAlign: "center" }}>
        <button type="button" className="btn-kick" onClick={onPlayAgain}>
          {playAgainLabel}
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
  const [done, setDone] = useState(false);
  return (
    <>
      <MatchView
        key={timeline.seed}
        timeline={timeline}
        labels={labels}
        onDone={() => setDone(true)}
      />
      {done && <StatsPanel timeline={timeline} labels={labels} />}
    </>
  );
}

interface CampaignFixture {
  timeline: MatchTimeline;
  home: string;
  away: string;
  header: string;
}

function CampaignPlayer({
  sequence,
  onAllDone,
}: {
  sequence: CampaignFixture[];
  onAllDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [matchDone, setMatchDone] = useState(false);

  const allDone = index >= sequence.length;
  useEffect(() => {
    if (allDone) onAllDone();
  }, [allDone, onAllDone]);

  if (sequence.length === 0) return null;
  if (allDone) {
    return (
      <section className="panel" style={{ padding: "1rem", textAlign: "center" }}>
        <div className="eyebrow">{S.campaign.kicker}</div>
        <h3 className="panel__title">{S.campaign.done}</h3>
        <p className="dim">{S.campaign.watchAgain}</p>
      </section>
    );
  }

  const cur = sequence[index]!;
  const labels = { home: cur.home, away: cur.away };
  return (
    <>
      <MatchView
        key={cur.timeline.seed}
        timeline={cur.timeline}
        labels={labels}
        header={cur.header}
        onDone={() => setMatchDone(true)}
        onComplete={() => {
          setMatchDone(false);
          setIndex((i) => i + 1);
        }}
      />
      {matchDone && <StatsPanel timeline={cur.timeline} labels={labels} />}
      {matchDone && (
        <ShareHighlight timeline={cur.timeline} homeLabel={cur.home} awayLabel={cur.away} />
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MatchTimeline, ResolvedTournament } from "7a0-engine";
import { MatchView } from "./MatchView";
import { StatsPanel } from "./StatsPanel";
import { ShareHighlight } from "./ShareHighlight";
import { StampReveal } from "./motion";
import { useStrings } from "../_i18n/LocaleProvider";
import type { StringCatalog } from "../_i18n/types";

export type TournamentViewState = ResolvedTournament & {
  /** Optional Convex id — offline runs omit this. */
  tournamentId?: string;
};

function slotName(
  participants: TournamentViewState["participants"],
  slot: number,
  S: StringCatalog,
): string {
  return participants.find((p) => p.slot === slot)?.name ?? S.tournament.slotName(slot);
}

function myJourney(state: TournamentViewState, mySlot: number, S: StringCatalog): string {
  const myGroup = state.participants.find((p) => p.slot === mySlot)?.groupIndex;
  const final = state.matches.find((m) => m.stage === "final");
  const semis = state.matches.filter((m) => m.stage === "semi");
  if (state.championSlot === mySlot) return S.tournament.champion;
  if (final && (final.homeSlot === mySlot || final.awaySlot === mySlot)) return S.tournament.runnerUp;
  const mySemi = semis.find((m) => m.homeSlot === mySlot || m.awaySlot === mySlot);
  if (mySemi) return S.tournament.eliminatedSemifinal;
  const standing = state.standings.find((s) => s.groupIndex === myGroup);
  const rank = standing?.table.findIndex((t) => t.slot === mySlot) ?? -1;
  if (rank >= 0 && rank < 2) return S.tournament.advancedGroup;
  return S.tournament.eliminatedGroup;
}

export function TournamentReveal({
  state,
  mySlot,
  onPlayAgain,
  playAgainLabel,
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
  const S = useStrings();
  const againLabel = playAgainLabel ?? S.duel.playAgain;
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
      home: slotName(state.participants, m.homeSlot, S),
      away: slotName(state.participants, m.awaySlot, S),
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
            <StampReveal
              as="h2"
              className="panel__title"
              tone={mySlot !== undefined && state.championSlot === mySlot ? "gold" : "neutral"}
            >
              {mySlot !== undefined ? myJourney(state, mySlot, S) : S.tournament.complete}
            </StampReveal>
            <p className="mono dim">
              {S.tournament.championLabel}: {slotName(state.participants, state.championSlot, S)}
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
            {state.standings.map((group, gi) => (
              <div
                key={group.groupIndex}
                className="stagger-in__item"
                style={{ flex: "1 1 280px", animationDelay: `${gi * 120}ms` }}
              >
                <h3 className="panel__title">
                  {group.groupIndex === 0 ? S.tournament.groupA : S.tournament.groupB}
                </h3>
                <table className="mono" style={{ width: "100%", fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th align="left">{S.tournament.team}</th>
                      <th>{S.tournament.played}</th>
                      <th>{S.tournament.gd}</th>
                      <th>{S.tournament.pts}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.table.map((row) => (
                      <tr
                        key={row.slot}
                        style={row.slot === mySlot ? { fontWeight: "bold" } : undefined}
                      >
                        <td>{slotName(state.participants, row.slot, S)}</td>
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
              <h3 className="panel__title">{S.tournament.yourFixtures}</h3>
              {myMatches
                .filter((m) => m.stage === "group")
                .map((m, i) => {
                  const home = slotName(state.participants, m.homeSlot, S);
                  const away = slotName(state.participants, m.awaySlot, S);
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
            <h3 className="panel__title">{S.tournament.knockout}</h3>
            {semis.map((m, i) => {
              const home = slotName(state.participants, m.homeSlot, S);
              const away = slotName(state.participants, m.awaySlot, S);
              const key = state.matches.indexOf(m);
              return (
                <div key={`sf-${i}`} style={{ marginBottom: "0.5rem" }}>
                  <button
                    type="button"
                    className="mono"
                    onClick={() => setExpanded(expanded === key ? null : key)}
                    style={{ width: "100%", textAlign: "left" }}
                  >
                    {S.tournament.semifinalN(i + 1)}: {home} {m.gf}–{m.ga} {away}
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
                  {S.tournament.final}: {slotName(state.participants, final.homeSlot, S)} {final.gf}–{final.ga}{" "}
                  {slotName(state.participants, final.awaySlot, S)}
                </button>
                {expanded === state.matches.indexOf(final) && (
                  <FixtureDetail
                    timeline={final.timeline}
                    home={slotName(state.participants, final.homeSlot, S)}
                    away={slotName(state.participants, final.awaySlot, S)}
                  />
                )}
              </div>
            )}
          </section>
        </>
      )}

      <section className="hero__cta" style={{ padding: "1rem", textAlign: "center" }}>
        <button type="button" className="btn-kick" onClick={onPlayAgain}>
          {againLabel}
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
  const S = useStrings();
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

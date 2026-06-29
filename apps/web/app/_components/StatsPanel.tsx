"use client";

/**
 * StatsPanel — the M3 match-statistics breakdown (MVP §4.4 / GAME-GUIDE §10).
 *
 * Reads the same MatchTimeline as MatchView, via the engine's pure
 * `computeMatchStats` consumer, and shows both teams side-by-side. The stats
 * describe the final result, so they are independent of the Fast/Ultra tier and
 * of ticker progress.
 */

import { useEffect, useState } from "react";
import { computeMatchStats, type MatchTimeline } from "7a0-engine";
import { useStrings } from "../_i18n/LocaleProvider";
import { CountUp, StaggerIn } from "./motion";

interface StatRow {
  label: string;
  home: number;
  away: number;
  decimals?: number;
  suffix?: string;
  /** Composite values (e.g. cards "y/r") rendered verbatim, no count-up. */
  homeText?: string;
  awayText?: string;
}

export function StatsPanel({
  timeline,
  labels,
}: {
  timeline: MatchTimeline;
  labels: { home: string; away: string };
}) {
  const S = useStrings();
  const stats = computeMatchStats(timeline);

  // Hold bars at zero for one frame so they sweep to their share on appear.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const rows: StatRow[] = [
    {
      label: S.stats.possession,
      home: stats.home.possession,
      away: stats.away.possession,
      suffix: "%",
    },
    { label: S.stats.shots, home: stats.home.shots, away: stats.away.shots },
    {
      label: S.stats.shotsOnTarget,
      home: stats.home.shotsOnTarget,
      away: stats.away.shotsOnTarget,
    },
    { label: S.stats.corners, home: stats.home.corners, away: stats.away.corners },
    { label: S.stats.penalties, home: stats.home.penalties, away: stats.away.penalties },
    { label: S.stats.passes, home: stats.home.passes, away: stats.away.passes },
    { label: S.stats.fouls, home: stats.home.fouls, away: stats.away.fouls },
    {
      label: S.stats.cards,
      home: 0,
      away: 0,
      homeText: `${stats.home.yellowCards}/${stats.home.redCards}`,
      awayText: `${stats.away.yellowCards}/${stats.away.redCards}`,
    },
    { label: S.stats.offsides, home: stats.home.offsides, away: stats.away.offsides },
    { label: S.stats.xg, home: stats.home.xg, away: stats.away.xg, decimals: 1 },
  ];

  return (
    <section className="panel">
      <div className="eyebrow">{S.stats.kicker}</div>
      <h2 className="panel__title">{S.stats.heading}</h2>

      <div
        className="row"
        style={{ justifyContent: "space-between", margin: "1rem 0 0.5rem" }}
      >
        <strong style={{ color: "var(--home)", fontSize: "0.95rem" }}>
          {labels.home}
        </strong>
        <strong style={{ color: "var(--away)", fontSize: "0.95rem", textAlign: "right" }}>
          {labels.away}
        </strong>
      </div>

      {/* Possession bar: home share vs away share, sweeping in on reveal. */}
      <div className="versus versus--animated" aria-hidden style={{ marginBottom: "1rem" }}>
        <div
          className="versus__home"
          style={{ width: `${revealed ? stats.home.possession : 50}%` }}
        />
        <div
          className="versus__away"
          style={{ width: `${revealed ? stats.away.possession : 50}%` }}
        />
      </div>

      <StaggerIn step={45}>
        {rows.map((r) => (
          <div key={r.label} className="statrow">
            <span className="statrow__val statrow__val--home">
              {r.homeText !== undefined ? (
                r.homeText
              ) : (
                <CountUp value={r.home} decimals={r.decimals} suffix={r.suffix} />
              )}
            </span>
            <span className="statrow__label">{r.label}</span>
            <span className="statrow__val statrow__val--away">
              {r.awayText !== undefined ? (
                r.awayText
              ) : (
                <CountUp value={r.away} decimals={r.decimals} suffix={r.suffix} />
              )}
            </span>
          </div>
        ))}
      </StaggerIn>
    </section>
  );
}

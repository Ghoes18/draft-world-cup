"use client";

/**
 * StatsPanel — the M3 match-statistics breakdown (MVP §4.4 / GAME-GUIDE §10).
 *
 * Reads the same MatchTimeline as MatchView, via the engine's pure
 * `computeMatchStats` consumer, and shows both teams side-by-side. The stats
 * describe the final result, so they are independent of the Fast/Ultra tier and
 * of ticker progress.
 */

import { computeMatchStats, type MatchTimeline } from "7a0-engine";
import { STRINGS as S } from "../_data/strings";

export function StatsPanel({
  timeline,
  labels,
}: {
  timeline: MatchTimeline;
  labels: { home: string; away: string };
}) {
  const stats = computeMatchStats(timeline);

  const rows: { label: string; home: string; away: string }[] = [
    {
      label: S.stats.possession,
      home: `${stats.home.possession}%`,
      away: `${stats.away.possession}%`,
    },
    { label: S.stats.shots, home: `${stats.home.shots}`, away: `${stats.away.shots}` },
    {
      label: S.stats.shotsOnTarget,
      home: `${stats.home.shotsOnTarget}`,
      away: `${stats.away.shotsOnTarget}`,
    },
    { label: S.stats.corners, home: `${stats.home.corners}`, away: `${stats.away.corners}` },
    {
      label: S.stats.penalties,
      home: `${stats.home.penalties}`,
      away: `${stats.away.penalties}`,
    },
    { label: S.stats.passes, home: `${stats.home.passes}`, away: `${stats.away.passes}` },
    { label: S.stats.xg, home: stats.home.xg.toFixed(1), away: stats.away.xg.toFixed(1) },
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

      {/* Possession bar: home share vs away share. */}
      <div className="versus" aria-hidden style={{ marginBottom: "1rem" }}>
        <div className="versus__home" style={{ width: `${stats.home.possession}%` }} />
        <div className="versus__away" style={{ width: `${stats.away.possession}%` }} />
      </div>

      <div>
        {rows.map((r) => (
          <div key={r.label} className="statrow">
            <span className="statrow__val statrow__val--home">{r.home}</span>
            <span className="statrow__label">{r.label}</span>
            <span className="statrow__val statrow__val--away">{r.away}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

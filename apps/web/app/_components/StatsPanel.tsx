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
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "1rem 1.25rem",
        margin: "1rem 0",
        maxWidth: 720,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>{S.stats.heading}</h2>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "var(--muted)",
          fontSize: "0.85rem",
          marginBottom: "0.6rem",
        }}
      >
        <strong>{labels.home}</strong>
        <strong>{labels.away}</strong>
      </div>

      {/* Possession bar: home share vs away share. */}
      <div
        aria-hidden
        style={{
          display: "flex",
          height: 8,
          borderRadius: 999,
          overflow: "hidden",
          marginBottom: "0.9rem",
          background: "var(--border)",
        }}
      >
        <div style={{ width: `${stats.home.possession}%`, background: "#4f9dff" }} />
        <div style={{ width: `${stats.away.possession}%`, background: "#ff9d4f" }} />
      </div>

      <div style={{ display: "grid", gap: "0.4rem", fontSize: "0.9rem" }}>
        {rows.map((r) => (
          <div
            key={r.label}
            style={{
              display: "grid",
              gridTemplateColumns: "3rem 1fr 3rem",
              alignItems: "center",
            }}
          >
            <span style={{ textAlign: "left", fontWeight: 600 }}>{r.home}</span>
            <span style={{ textAlign: "center", color: "var(--muted)" }}>{r.label}</span>
            <span style={{ textAlign: "right", fontWeight: 600 }}>{r.away}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

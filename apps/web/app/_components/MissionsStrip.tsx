"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { MissionView } from "./MissionCard";
import { STRINGS as S } from "../_data/strings";

interface BossResult {
  gf: number;
  ga: number;
  beat: boolean;
}

/** Compact horizontal strip — daily missions + Weekly Boss — shown on the home
 *  page. Each tile links to /missions for the full flow. Safe to call only
 *  when the Convex provider is present (parent gates on convexReady). */
export function MissionsStrip({ playerId }: { playerId: string }) {
  const missions = useQuery(api.missions.myMissions, { playerId }) as
    | MissionView[]
    | undefined;
  const boss = useQuery(api.boss.currentBoss, {});
  const bossStatus = useQuery(api.boss.myBossStatus, { playerId });

  const daily = useMemo(
    () => missions?.filter((m) => m.type === "daily").slice(0, 3) ?? [],
    [missions],
  );

  if (!missions || !boss) return null;

  return (
    <section className="objectives" aria-label="Today's objectives">
      <p className="objectives__kicker mono">Today — Objectives</p>
      <div className="objectives__row" role="list">
        {daily.map((m) => (
          <MissionTile key={m.id} mission={m} />
        ))}
        <BossTile
          team={boss.scenario.team}
          cup={boss.scenario.cup}
          triedToday={bossStatus?.triedToday ?? false}
          today={bossStatus?.today ?? null}
        />
      </div>
    </section>
  );
}

function MissionTile({ mission }: { mission: MissionView }) {
  const { title, category, progress, target, completed } = mission;
  const pct = target > 0 ? Math.min(100, (progress / target) * 100) : 0;

  return (
    <a
      href="/missions"
      className={["obj-tile", completed ? "obj-tile--done" : ""].join(" ").trim()}
      role="listitem"
      aria-label={`${title} — ${completed ? "complete" : `${progress} of ${target}`}`}
    >
      <div className="obj-tile__head">
        <span className="obj-tile__chip mono">{S.missions.category[category]}</span>
        {completed && <span className="obj-tile__badge">✓</span>}
      </div>
      <p className="obj-tile__name">{title}</p>
      <div
        className="obj-tile__bar"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={target}
      >
        <div className="obj-tile__fill" style={{ width: `${pct}%` }} />
      </div>
    </a>
  );
}

function BossTile({
  team,
  cup,
  triedToday,
  today,
}: {
  team: string;
  cup: number;
  triedToday: boolean;
  today: BossResult | null;
}) {
  const beatPct = today?.beat ? 100 : triedToday ? 40 : 0;

  return (
    <a
      href="/missions"
      className="obj-tile obj-tile--boss"
      role="listitem"
      aria-label={`Weekly Boss: ${team}`}
    >
      <div className="obj-tile__head">
        <span className="obj-tile__chip obj-tile__chip--boss mono">
          {S.boss.kicker}
        </span>
        {today?.beat && (
          <span className="obj-tile__badge obj-tile__badge--boss">✓</span>
        )}
      </div>
      <p className="obj-tile__name">{S.boss.sub(team, cup)}</p>
      {today ? (
        <p className="obj-tile__score mono">
          {today.gf}–{today.ga}
          {today.beat && " ✓"}
        </p>
      ) : (
        <p className="obj-tile__cta mono">
          {triedToday ? S.boss.againTomorrow : `${S.boss.challenge} →`}
        </p>
      )}
      <div className="obj-tile__bar">
        <div
          className="obj-tile__fill obj-tile__fill--boss"
          style={{ width: `${beatPct}%` }}
        />
      </div>
    </a>
  );
}

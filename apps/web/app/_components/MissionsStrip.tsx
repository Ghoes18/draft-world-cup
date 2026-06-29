"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { bossCopy, missionCopy } from "7a0-engine";
import { api } from "../../convex/_generated/api";
import type { MissionView } from "./MissionCard";
import type { BossView } from "./BossCard";
import { normalizeBossView } from "../_data/bossView";
import { useLocale, useStrings } from "../_i18n/LocaleProvider";

interface BossResult {
  gf: number;
  ga: number;
  beat: boolean;
}

/** Compact horizontal strip — daily missions + Weekly Boss — shown on the home page. */
export function MissionsStrip({ playerId }: { playerId: string }) {
  const S = useStrings();
  const missions = useQuery(api.missions.myMissions, { playerId }) as
    | MissionView[]
    | undefined;
  const bossRaw = useQuery(api.boss.currentBoss, {});
  const bossStatus = useQuery(api.boss.myBossStatus, { playerId });

  const boss = useMemo(() => normalizeBossView(bossRaw), [bossRaw]);

  const daily = useMemo(
    () => missions?.filter((m) => m.type === "daily").slice(0, 3) ?? [],
    [missions],
  );

  if (!missions || !boss) return null;

  return (
    <section className="objectives" aria-label={S.missions.stripAria}>
      <div className="objectives__head">
        <p className="objectives__kicker mono">{S.missions.stripHeading}</p>
        <a href="/missions" className="objectives__link mono">
          {S.nav.missions} →
        </a>
      </div>
      <div className="objectives__row" role="list">
        {daily.map((m) => (
          <MissionTile key={m.id} mission={m} />
        ))}
        <BossTile
          boss={boss}
          triedToday={bossStatus?.triedToday ?? false}
          today={bossStatus?.today ?? null}
        />
      </div>
    </section>
  );
}

function MissionTile({ mission }: { mission: MissionView }) {
  const S = useStrings();
  const { locale } = useLocale();
  const copy = missionCopy(mission.id, locale, {
    title: mission.title,
    description: mission.description,
  });
  const { category, progress, target, completed } = mission;
  const pct = target > 0 ? Math.min(100, (progress / target) * 100) : 0;

  return (
    <a
      href="/missions"
      className={[
        "obj-tile",
        `obj-tile--${category}`,
        completed ? "obj-tile--done" : "",
      ]
        .join(" ")
        .trim()}
      role="listitem"
      aria-label={
        completed
          ? S.missions.progressCompleteAria(copy.title)
          : S.missions.progressAria(copy.title, progress, target)
      }
    >
      <div className="obj-tile__head">
        <span className="obj-tile__chip mono">{S.missions.category[category]}</span>
        {completed ? (
          <span className="obj-tile__status obj-tile__status--done mono">
            ✓ {S.missions.done}
          </span>
        ) : (
          <span className="obj-tile__status mono">
            {S.missions.progress(progress, target)}
          </span>
        )}
      </div>
      <p className="obj-tile__name">{copy.title}</p>
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
  boss,
  triedToday,
  today,
}: {
  boss: BossView;
  triedToday: boolean;
  today: BossResult | null;
}) {
  const S = useStrings();
  const { locale } = useLocale();
  const localized = bossCopy(boss.id, locale, { name: boss.name, subtitle: boss.subtitle });
  const beatPct = today?.beat ? 100 : triedToday ? 40 : 0;

  return (
    <a
      href="/missions"
      className="obj-tile obj-tile--boss"
      role="listitem"
      aria-label={S.missions.bossAria(localized.name)}
    >
      <div className="obj-tile__head">
        <span className="obj-tile__chip obj-tile__chip--boss mono">
          {S.boss.kicker}
        </span>
        {today?.beat ? (
          <span className="obj-tile__status obj-tile__status--boss mono">✓</span>
        ) : today ? (
          <span className="obj-tile__score mono">
            {today.gf}–{today.ga}
          </span>
        ) : null}
      </div>
      <p className="obj-tile__name">{localized.name}</p>
      <p className="obj-tile__meta mono">
        {today ? (
          <span className="obj-tile__hint dim">
            {today.beat ? S.boss.beatIt : S.boss.notYet}
          </span>
        ) : (
          <>
            <span className="obj-tile__hint dim">
              {S.boss.difficulty[boss.difficulty] ?? S.boss.difficulty.hard}
            </span>
            <span className="obj-tile__cta">
              {triedToday ? S.boss.againTomorrow : `${S.boss.challenge} →`}
            </span>
          </>
        )}
      </p>
      <div className="obj-tile__bar">
        <div
          className="obj-tile__fill obj-tile__fill--boss"
          style={{ width: `${beatPct}%` }}
        />
      </div>
    </a>
  );
}

"use client";

import { bossCopy } from "7a0-engine";
import { playerTier, type BuildState, type SquadCatalog } from "7a0-engine";
import { tierNameClass } from "../_lib/tierClasses";
import { Pitch } from "./Pitch";
import { HoloCard3D } from "./three";
import { useLocale, useStrings } from "../_i18n/LocaleProvider";

export type BossDifficulty = "hard" | "veryHard";

export interface BossLineupPlayer {
  id: string;
  name: string;
  overall: number;
  position: string;
}

export interface BossView {
  weekKey: string;
  id: string;
  name: string;
  subtitle: string;
  difficulty: BossDifficulty;
  featuredPlayers: string[];
  tactic: "offensive" | "balanced" | "defensive";
  lineup: BossLineupPlayer[];
  buildState: BuildState | null;
}

interface BossResult {
  gf: number;
  ga: number;
  beat: boolean;
}

/** Weekly Boss summary: who they are, your daily/weekly results, and a CTA. */
export function BossCard({
  boss,
  catalog,
  triedToday,
  today,
  bestThisWeek,
  canChallenge,
  onChallenge,
  note,
}: {
  boss: BossView;
  catalog: SquadCatalog;
  triedToday: boolean;
  today: BossResult | null;
  bestThisWeek: BossResult | null;
  canChallenge: boolean;
  onChallenge: () => void;
  note?: string;
}) {
  const S = useStrings();
  const { locale } = useLocale();
  const localized = bossCopy(boss.id, locale, { name: boss.name, subtitle: boss.subtitle });

  const fmt = (r: BossResult | null) =>
    r ? `${r.gf}–${r.ga}${r.beat ? " ✓" : ""}` : S.boss.noResult;

  const showSquad = boss.buildState && boss.lineup.length > 0;

  return (
    <section className="boss-card boss-card--event panel" aria-label={S.boss.heading}>
      <div className="boss-card__meta">
        <p className="panel__kicker mono dim">{S.boss.kicker}</p>
        <span
          className={`boss-card__difficulty boss-card__difficulty--${boss.difficulty} mono`}
        >
          {S.boss.difficulty[boss.difficulty] ?? S.boss.difficulty.hard}
        </span>
      </div>
      <h2 className="boss-card__name">{localized.name}</h2>
      <p className="boss-card__subtitle dim">{localized.subtitle}</p>
      {(boss.featuredPlayers?.length ?? 0) > 0 ? (
        <p className="boss-card__featured dim">
          <span className="mono">{S.boss.featured}</span>{" "}
          <span className="boss-card__featured-names holo-foil">
            {boss.featuredPlayers.join(" · ")}
          </span>
        </p>
      ) : null}

      {showSquad ? (
        <div className="boss-card__squad">
          <HoloCard3D tone="away" className="boss-card__pitch">
            <Pitch catalog={catalog} buildState={boss.buildState!} compact />
          </HoloCard3D>
          <div className="boss-card__lineup">
            <p className="boss-card__lineup-kicker mono dim">{S.boss.lineup}</p>
            <ol className="boss-card__lineup-list">
              {boss.lineup.map((player) => (
                <li key={player.id} className="boss-card__lineup-row">
                  <span className="boss-card__lineup-pos mono dim">{player.position}</span>
                  <span
                    className={[
                      "boss-card__lineup-name",
                      tierNameClass(playerTier(player)),
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {player.name}
                  </span>
                  <span
                    className="boss-card__lineup-ovr mono"
                    aria-label={`${S.build.playerOvr} ${player.overall}`}
                  >
                    {player.overall}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}

      <dl className="boss-card__stats">
        <div>
          <dt className="dim mono">{S.boss.today}</dt>
          <dd className="mono">{fmt(today)}</dd>
        </div>
        <div>
          <dt className="dim mono">{S.boss.best}</dt>
          <dd className="mono">{fmt(bestThisWeek)}</dd>
        </div>
      </dl>

      {triedToday && today ? (
        <p className={today.beat ? "boss-card__verdict--win" : "boss-card__verdict--loss"}>
          {today.beat ? S.boss.beatIt : S.boss.notYet}
        </p>
      ) : null}

      <button
        className="btn-kick pressable pressable--glow"
        disabled={!canChallenge}
        onClick={onChallenge}
      >
        {triedToday ? S.boss.againTomorrow : S.boss.challenge}
      </button>
      {note ? <p className="boss-card__note dim">{note}</p> : null}
    </section>
  );
}

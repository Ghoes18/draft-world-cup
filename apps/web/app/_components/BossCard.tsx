import { STRINGS as S } from "../_data/strings";

interface BossResult {
  gf: number;
  ga: number;
  beat: boolean;
}

/** Weekly Boss summary: who they are, your daily/weekly results, and a CTA. */
export function BossCard({
  team,
  cup,
  triedToday,
  today,
  bestThisWeek,
  canChallenge,
  onChallenge,
  note,
}: {
  team: string;
  cup: number;
  triedToday: boolean;
  today: BossResult | null;
  bestThisWeek: BossResult | null;
  canChallenge: boolean;
  onChallenge: () => void;
  note?: string;
}) {
  const fmt = (r: BossResult | null) =>
    r ? `${r.gf}–${r.ga}${r.beat ? " ✓" : ""}` : S.boss.noResult;

  return (
    <section className="boss-card panel" aria-label={S.boss.heading}>
      <p className="panel__kicker mono dim">{S.boss.kicker}</p>
      <h2 className="boss-card__name">{S.boss.sub(team, cup)}</h2>
      <p className="boss-card__blurb dim">{S.boss.blurb}</p>

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

      <button className="btn-kick" disabled={!canChallenge} onClick={onChallenge}>
        {triedToday ? S.boss.againTomorrow : S.boss.challenge}
      </button>
      {note ? <p className="boss-card__note dim">{note}</p> : null}
    </section>
  );
}

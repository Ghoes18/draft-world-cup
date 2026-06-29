"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Header } from "../_components/Header";
import { Footer } from "../_components/Footer";
import { usePlayerId } from "../_hooks/usePlayerId";
import { STRINGS as S } from "../_data/strings";

const L = S.leaderboard;

type Placement = "champion" | "finalist" | "semifinalist" | "group";

type LeaderRow = {
  rank: number;
  playerId: string;
  name: string;
  elo: number;
  peakElo: number;
  wins: number;
  draws: number;
  losses: number;
  played: number;
  tournaments: number;
  titles: number;
};

type RatingView = {
  rated: boolean;
  playerId: string;
  name: string;
  elo: number;
  peakElo: number;
  wins: number;
  draws: number;
  losses: number;
  played: number;
  tournaments: number;
  titles: number;
  lastDelta?: number;
  lastTournamentId?: string;
};

type HistoryItem = {
  tournamentId: string;
  createdAt: number;
  placement: Placement;
  slot: number;
};

function unnamed(playerId: string): string {
  return `${L.coach} ${playerId.slice(0, 4).toUpperCase()}`;
}

export default function LeaderboardPage() {
  const { playerId } = usePlayerId();
  const convexReady = process.env.NEXT_PUBLIC_CONVEX_URL != null;

  return (
    <main className="shell">
      <Header meta={L.heading} />
      {!convexReady ? (
        <section className="missions-page">
          <p className="panel__kicker mono dim">{L.kicker}</p>
          <h1 className="missions-page__title">{L.heading}</h1>
          <p className="dim">{L.needConvex}</p>
        </section>
      ) : !playerId ? (
        <p className="dim">{L.loading}</p>
      ) : (
        <LeaderboardContent playerId={playerId} />
      )}
      <Footer />
    </main>
  );
}

function LeaderboardContent({ playerId }: { playerId: string }) {
  const rows = useQuery(api.ratings.leaderboard, { limit: 50 }) as
    | LeaderRow[]
    | undefined;
  const mine = useQuery(api.ratings.myRating, { playerId }) as
    | RatingView
    | undefined;
  const history = useQuery(api.ratings.myHistory, { playerId, limit: 8 }) as
    | HistoryItem[]
    | undefined;

  const podium = rows && rows.length > 0 ? rows.slice(0, 3) : [];
  const tableRows = rows ? rows.slice(3) : [];
  const youInRows = rows?.some((r) => r.playerId === playerId) ?? false;
  const showYouAfar =
    !!mine && mine.rated && !!rows && rows.length > 0 && !youInRows;

  return (
    <section className="missions-page">
      <p className="panel__kicker mono dim">{L.kicker}</p>
      <h1 className="missions-page__title">{L.heading}</h1>
      <p className="dim missions-page__hint">{L.blurb}</p>

      <div className="leaderboard">
        {mine && <YourRating mine={mine} showAfar={showYouAfar} />}

        {rows === undefined ? (
          <p className="dim">{L.loading}</p>
        ) : rows.length === 0 ? (
          <p className="dim">{L.empty}</p>
        ) : (
          <>
            {podium.length > 0 && (
              <Podium rows={podium} playerId={playerId} />
            )}

            <Standings
              rows={tableRows}
              playerId={playerId}
              afarRow={showYouAfar && mine ? toLeaderRow(mine) : null}
            />
          </>
        )}

        {history && history.length > 0 && <History history={history} />}
      </div>
    </section>
  );
}

function toLeaderRow(m: RatingView): LeaderRow {
  return {
    rank: 0,
    playerId: m.playerId,
    name: m.name,
    elo: m.elo,
    peakElo: m.peakElo,
    wins: m.wins,
    draws: m.draws,
    losses: m.losses,
    played: m.played,
    tournaments: m.tournaments,
    titles: m.titles,
  };
}

function YourRating({
  mine,
  showAfar,
}: {
  mine: RatingView;
  showAfar: boolean;
}) {
  if (!mine.rated) {
    return (
      <div className="lb-you">
        <p className="lb-you__tag">{L.you}</p>
        <p className="lb-you__unrated">{L.unrated}</p>
      </div>
    );
  }

  const delta = mine.lastDelta;
  const deltaClass =
    delta == null
      ? ""
      : delta >= 0
        ? "lb-you__delta--up"
        : "lb-you__delta--down";
  const deltaLabel = delta == null ? null : L.delta(delta);

  return (
    <div className="lb-you">
      <div className="lb-you__head">
        <div>
          <p className="lb-you__tag">{L.you}</p>
          <p className="lb-you__name">{mine.name || unnamed(mine.playerId)}</p>
        </div>
        <div className="lb-you__elo-row">
          <span className="lb-you__elo">{mine.elo}</span>
          {deltaLabel != null && (
            <span className={`lb-you__delta ${deltaClass}`}>{deltaLabel}</span>
          )}
          <span className="lb-you__peak">PEAK {mine.peakElo}</span>
        </div>
      </div>

      <div className="lb-you__stats">
        <Stat label={L.record} value={`${mine.wins}/${mine.draws}/${mine.losses}`} />
        <Stat label={L.played} value={String(mine.played)} />
        <Stat label={L.tournaments} value={String(mine.tournaments)} />
        <Stat
          label={L.titlesLabel}
          value={String(mine.titles)}
          gold={mine.titles > 0}
        />
      </div>

      {showAfar && <p className="lb-you__afar">{L.notRanked}</p>}
    </div>
  );
}

function Stat({
  label,
  value,
  gold,
}: {
  label: string;
  value: string;
  gold?: boolean;
}) {
  return (
    <div className="lb-stat">
      <span className="lb-stat__label">{label}</span>
      <span className={`lb-stat__val${gold ? " lb-stat__val--gold" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Podium({
  rows,
  playerId,
}: {
  rows: LeaderRow[];
  playerId: string;
}) {
  // Display order: runner-up · champion · third (champion on the tall center riser).
  const order: { r: LeaderRow; place: 1 | 2 | 3 }[] = [];
  if (rows[1]) order.push({ r: rows[1], place: 2 });
  if (rows[0]) order.push({ r: rows[0], place: 1 });
  if (rows[2]) order.push({ r: rows[2], place: 3 });

  return (
    <div className="lb-podium" role="list" aria-label="Top three coaches">
      {order.map(({ r, place }) => {
        const isYou = r.playerId === playerId;
        const tag =
          place === 1
            ? L.podium.champion
            : place === 2
              ? L.podium.runnerUp
              : L.podium.third;
        return (
          <div
            key={r.playerId}
            className={`lb-podium__col lb-podium__col--${place}${isYou ? " lb-podium__col--you" : ""}`}
            role="listitem"
          >
            <div className="lb-podium__card">
              <span className="lb-podium__tag">{tag}</span>
              <span className="lb-podium__name">
                {r.name || unnamed(r.playerId)}
              </span>
              <span className="lb-podium__elo">{r.elo}</span>
              <span className="lb-podium__titles">
                {r.titles > 0 ? `${r.titles} 🏆` : ""}
              </span>
            </div>
            <div className="lb-podium__riser" aria-hidden="true">
              {place}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Standings({
  rows,
  playerId,
  afarRow,
}: {
  rows: LeaderRow[];
  playerId: string;
  afarRow: LeaderRow | null;
}) {
  return (
    <div className="lb-board">
      <p className="lb-board__head">{L.standings}</p>
      <table className="lb-table">
        <thead>
          <tr>
            <th>{L.rank}</th>
            <th>{L.coach}</th>
            <th>{L.elo}</th>
            <th>{L.record}</th>
            <th>{L.titles}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.playerId} r={r} playerId={playerId} />
          ))}
          {afarRow && (
            <Row r={afarRow} playerId={playerId} afar />
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  r,
  playerId,
  afar,
}: {
  r: LeaderRow;
  playerId: string;
  afar?: boolean;
}) {
  const isYou = r.playerId === playerId;
  const cls = [
    isYou ? "lb-row--you" : "",
    afar ? "lb-row--afar" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <tr className={cls || undefined}>
      <td>
        <span className="lb-rank">{r.rank === 0 ? "—" : r.rank}</span>
      </td>
      <td>{r.name || unnamed(r.playerId)}</td>
      <td>{r.elo}</td>
      <td>
        {r.wins}/{r.draws}/{r.losses}
      </td>
      <td className={r.titles > 0 ? "lb-titles" : "lb-titles lb-titles--none"}>
        {r.titles > 0 ? `${r.titles} 🏆` : "—"}
      </td>
    </tr>
  );
}

function History({ history }: { history: HistoryItem[] }) {
  return (
    <div className="lb-history">
      <h3 className="lb-history__title">{L.history}</h3>
      <ul className="lb-history__list">
        {history.map((h) => (
          <li key={h.tournamentId} className="lb-history__item">
            <span className="lb-history__date">
              {new Date(h.createdAt).toLocaleDateString()}
            </span>
            <span className={`lb-place lb-place--${h.placement}`}>
              {L.placement[h.placement]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

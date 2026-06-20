"use client";

import type { MatchTimeline } from "7a0-engine";
import { Scorebug } from "./Scoreboard";
import { STRINGS as S } from "../_data/strings";

export function ResultCard({
  timeline,
  homeLabel,
  awayLabel,
  awayTag,
  seed,
  onAgain,
}: {
  timeline: MatchTimeline;
  homeLabel: string;
  awayLabel: string;
  awayTag?: string;
  seed: string;
  onAgain: () => void;
}) {
  const [home, away] = timeline.result.score;
  const pens = timeline.result.penalties;
  const winner =
    home > away
      ? "home"
      : away > home
        ? "away"
        : pens
          ? pens[0] > pens[1]
            ? "home"
            : pens[1] > pens[0]
              ? "away"
              : "draw"
          : "draw";

  const headline =
    winner === "home"
      ? S.result.win
      : winner === "away"
        ? S.result.loss
        : S.result.draw;

  return (
    <article className="result-card">
      <div className="result-card__stamp" aria-hidden>
        FT
      </div>
      <p className="eyebrow">{S.result.kicker}</p>
      <h2 className="result-card__headline">{headline}</h2>

      <Scorebug
        homeLabel={homeLabel}
        awayLabel={awayLabel}
        awayTag={awayTag}
        homeScore={home}
        awayScore={away}
        pens={pens ? [pens[0], pens[1]] : undefined}
      />

      <p className="result-card__seed mono dim">
        {S.result.seed} <code>{seed}</code>
      </p>

      <div className="result-card__actions">
        <button className="btn-kick" type="button" onClick={onAgain}>
          {S.result.again}
        </button>
      </div>
    </article>
  );
}

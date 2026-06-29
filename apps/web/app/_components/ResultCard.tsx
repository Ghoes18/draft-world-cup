"use client";

import { useEffect, useState } from "react";
import type { MatchTimeline } from "7a0-engine";
import { Scorebug } from "./Scoreboard";
import { ShareHighlight } from "./ShareHighlight";
import { StampReveal, ImpactBurst } from "./motion";
import { useStrings } from "../_i18n/LocaleProvider";

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
  const S = useStrings();
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

  // A celebratory burst on win — gold for a rout (margin >= 3) or a penalty win.
  const margin = Math.abs(home - away);
  const special = winner === "home" && (margin >= 3 || Boolean(pens));
  const [burst, setBurst] = useState<number | null>(null);
  useEffect(() => {
    if (!special) return;
    const id = requestAnimationFrame(() => setBurst(Date.now()));
    return () => cancelAnimationFrame(id);
  }, [special]);

  return (
    <article className="result-card">
      <ImpactBurst trigger={burst} tone={margin >= 5 ? "gold" : "home"} sparks={12} />
      <StampReveal className="result-card__stamp" tone={winner === "away" ? "away" : "home"}>
        <span aria-hidden>FT</span>
      </StampReveal>
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

      <ShareHighlight
        timeline={timeline}
        homeLabel={homeLabel}
        awayLabel={awayLabel}
        awayTag={awayTag}
      />
    </article>
  );
}

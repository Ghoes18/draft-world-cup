"use client";

/**
 * Scorebug — the broadcast fixture readout (the signature motif).
 */

import { useStrings } from "../_i18n/LocaleProvider";

export function Scorebug({
  homeLabel,
  awayLabel,
  homeTag,
  awayTag,
  homeScore,
  awayScore,
  pens,
}: {
  homeLabel: string;
  awayLabel: string;
  homeTag?: string;
  awayTag?: string;
  homeScore?: number;
  awayScore?: number;
  pens?: [number, number];
}) {
  const S = useStrings();
  const live = homeScore != null && awayScore != null;
  const h = live ? homeScore : "–";
  const a = live ? awayScore : "–";

  return (
    <div
      className="scorebug"
      role="img"
      aria-label={
        live
          ? S.scoreboard.liveAria(homeLabel, h as number, awayLabel, a as number)
          : S.scoreboard.notPlayedAria(homeLabel, awayLabel)
      }
    >
      <div className="scorebug__side scorebug__side--home">
        <div className="scorebug__team">{homeLabel}</div>
        {homeTag && <div className="scorebug__tag">{homeTag}</div>}
        <div className="scorebug__kit" />
      </div>

      <div>
        <div className="scorebug__score">
          <span className="scorebug__num--home">{h}</span>
          <span className="scorebug__colon" aria-hidden>
            :
          </span>
          <span className="scorebug__num--away">{a}</span>
        </div>
        {pens && (
          <span className="scorebug__pens">
            {S.scoreboard.pens(pens[0], pens[1])}
          </span>
        )}
      </div>

      <div className="scorebug__side scorebug__side--away">
        <div className="scorebug__team">{awayLabel}</div>
        {awayTag && <div className="scorebug__tag">{awayTag}</div>}
        <div className="scorebug__kit" />
      </div>
    </div>
  );
}

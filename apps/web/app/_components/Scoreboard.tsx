/**
 * Scorebug — the broadcast fixture readout (the signature motif).
 *
 * Home (you) on the left in lime, away (opponent) on the right in coral, with a
 * mono LED-style score and a blinking colon between. Used full-size in the hero
 * and inline elsewhere so one fixture motif recurs across the app.
 */

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
  const live = homeScore != null && awayScore != null;
  const h = live ? homeScore : "–";
  const a = live ? awayScore : "–";

  return (
    <div
      className="scorebug"
      role="img"
      aria-label={
        live
          ? `${homeLabel} ${h}, ${awayLabel} ${a}`
          : `${homeLabel} versus ${awayLabel}, not yet played`
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
            pens {pens[0]}–{pens[1]}
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

"use client";

import { useMemo } from "react";
import { highlightBadges, highlightToTimeline, type HighlightPayload } from "7a0-engine";
import { MatchView } from "../../_components/MatchView";
import { STRINGS as S } from "../../_data/strings";
import { formatScenarioLabel } from "../../_data/teamDisplay";

export function HighlightReplay({ payload }: { payload: HighlightPayload }) {
  const timeline = useMemo(() => highlightToTimeline(payload), [payload]);
  const badges = useMemo(() => highlightBadges(payload), [payload]);
  const labels = { home: payload.lb[0], away: payload.lb[1] };
  const scenario = formatScenarioLabel(payload.scn[0], payload.scn[1]);

  return (
    <main className="shell">
      <header className="highlight__head">
        <p className="eyebrow">{S.highlight.kicker}</p>
        <h1 className="highlight__title">{scenario}</h1>
      </header>

      <MatchView timeline={timeline} labels={labels} header={S.highlight.title} />

      {badges.length > 0 && (
        <section className="panel highlight__badges" aria-label={S.highlight.badges}>
          <p className="eyebrow">{S.highlight.badges}</p>
          <div className="highlight__chips">
            {badges.map((b) => (
              <span key={b.id} className="badge-chip" data-badge={b.id}>
                {b.label}
              </span>
            ))}
          </div>
        </section>
      )}

      <p className="highlight__cta">
        <a className="btn-kick" href="/">
          {S.highlight.buildYourOwn}
        </a>
      </p>
    </main>
  );
}

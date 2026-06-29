"use client";

import { useEffect, useRef, useState } from "react";
import { missionCopy } from "7a0-engine";
import { useLocale, useStrings } from "../_i18n/LocaleProvider";
import { ImpactBurst } from "./motion";

export interface MissionView {
  id: string;
  type: "daily" | "persistent";
  category: "composition" | "result" | "career";
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
}

/** A single mission: title, blurb, category chip, and a progress meter. */
export function MissionCard({ mission }: { mission: MissionView }) {
  const S = useStrings();
  const { locale } = useLocale();
  const copy = missionCopy(mission.id, locale, {
    title: mission.title,
    description: mission.description,
  });
  const { category, progress, target, completed } = mission;
  const pct = target > 0 ? Math.min(100, (progress / target) * 100) : 0;

  // Fire a celebratory burst only on the transition into completed — not for
  // missions that were already done when the list first rendered.
  const wasComplete = useRef<boolean | null>(null);
  const [burst, setBurst] = useState<number | null>(null);
  useEffect(() => {
    const prev = wasComplete.current;
    wasComplete.current = completed;
    if (prev === false && completed) setBurst(Date.now());
  }, [completed]);

  return (
    <article
      className={["mission-card", completed ? "mission-card--done" : ""].join(" ").trim()}
      aria-label={copy.title}
    >
      <ImpactBurst trigger={burst} tone="gold" sparks={10} />
      <header className="mission-card__head">
        <span className="mission-card__chip mono">{S.missions.category[category]}</span>
        {completed ? (
          <span className="mission-card__done" aria-label={S.missions.done}>
            ✓ {S.missions.done}
          </span>
        ) : (
          <span className="mission-card__count mono dim">
            {S.missions.progress(progress, target)}
          </span>
        )}
      </header>
      <h3 className="mission-card__title">{copy.title}</h3>
      <p className="mission-card__desc dim">{copy.description}</p>
      <div
        className="mission-card__track"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={target}
      >
        <div className="mission-card__fill" style={{ width: `${pct}%` }} />
      </div>
    </article>
  );
}

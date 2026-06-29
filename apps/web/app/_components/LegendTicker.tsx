"use client";

import { useEffect, useState } from "react";
import { LEGEND_DISPLAY_NAMES } from "7a0-engine";
import { useStrings } from "../_i18n/LocaleProvider";

const INTERVAL_MS = 2800;

/** Hero ticker — cycles through the canonical legend roster. */
export function LegendTicker() {
  const S = useStrings();
  const [index, setIndex] = useState(0);
  const names = LEGEND_DISPLAY_NAMES;

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % names.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [names.length]);

  return (
    <div className="legend" aria-live="polite">
      <span className="legend__label">{S.hero.legendLabel}</span>
      <span className="legend__name player-name--legend" key={names[index]}>
        {names[index]}
      </span>
    </div>
  );
}

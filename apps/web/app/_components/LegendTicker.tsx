"use client";

import { useEffect, useState } from "react";
import { LEGEND_DISPLAY_NAMES, legendDisplayTier } from "7a0-engine";
import { useStrings } from "../_i18n/LocaleProvider";
import { tierNameClass } from "../_lib/tierClasses";

const INTERVAL_MS = 2800;

/** Hero ticker — cycles through the canonical legend roster. */
export function LegendTicker() {
  const S = useStrings();
  const [index, setIndex] = useState(0);
  const names = LEGEND_DISPLAY_NAMES;
  const name = names[index] ?? names[0]!;

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % names.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [names.length]);

  return (
    <div className="legend" aria-live="polite">
      <span className="legend__label">{S.hero.legendLabel}</span>
      <span className={`legend__name ${tierNameClass(legendDisplayTier(name))}`} key={name}>
        {name}
      </span>
    </div>
  );
}

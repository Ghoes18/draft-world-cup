"use client";

import { useEffect, useState } from "react";
import { STRINGS as S } from "../_data/strings";

const INTERVAL_MS = 2800;

export function LegendTicker() {
  const [index, setIndex] = useState(0);
  const names = S.hero.legends;

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % names.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [names.length]);

  return (
    <div className="legend" aria-live="polite">
      <span className="legend__label">{S.hero.legendLabel}</span>
      <span className="legend__name" key={names[index]}>
        {names[index]}
      </span>
    </div>
  );
}

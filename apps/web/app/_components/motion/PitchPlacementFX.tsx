"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { PlayerTier } from "7a0-engine";
import { usePrefersReducedMotion } from "../../_hooks/useMotionPreference";
import { ImpactBurst } from "./ImpactBurst";

/**
 * The reward beat when a special player lands on the pitch:
 * - elite (85+) → a violet impact burst
 * - legend → a gold light shaft + gold burst ("luz")
 * - icon (retired great) → a monochrome smoke plume + light shaft ("fumaça")
 *
 * Fires once when `trigger` changes, then cleans itself up. Purely decorative:
 * always `aria-hidden`, never mounts under reduced motion or for normal tiers.
 */

const TONE = { elite: "elite", legend: "legend", icon: "icon" } as const;

export function PitchPlacementFX({
  tier,
  trigger,
  flame = false,
}: {
  tier: PlayerTier | null;
  /** Changes (e.g. to the slotId) when a placement should fire. */
  trigger: number | string | null;
  /** Captain Tsubasa easter egg — ignites a blue-flame burst regardless of tier. */
  flame?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const special = flame || tier === "elite" || tier === "legend" || tier === "icon";
  const [active, setActive] = useState<typeof trigger>(null);

  useEffect(() => {
    if (reduced || !special || trigger == null) return;
    setActive(trigger);
    const id = setTimeout(() => setActive(null), 1100);
    return () => clearTimeout(id);
  }, [trigger, reduced, special]);

  if (reduced || !special || active == null) return null;

  // Easter-egg blue fire wins over the normal tier beat.
  if (flame) {
    return (
      <span className="placement-fx placement-fx--tsubasa" key={String(active)} aria-hidden>
        <ImpactBurst trigger={active} tone="tsubasa" sparks={14} />
        <span className="placement-fx__flash" />
        <span className="placement-fx__flames">
          {Array.from({ length: 7 }).map((_, i) => (
            <span
              key={i}
              className="placement-fx__flame"
              style={{ "--flame": i } as CSSProperties}
            />
          ))}
        </span>
      </span>
    );
  }

  if (!tier) return null;

  return (
    <span
      className={`placement-fx placement-fx--${tier}`}
      key={String(active)}
      aria-hidden
    >
      <ImpactBurst
        trigger={active}
        tone={TONE[tier as keyof typeof TONE]}
        sparks={tier === "elite" ? 10 : 12}
      />
      {(tier === "legend" || tier === "icon") && (
        <span className="placement-fx__shaft" />
      )}
      {tier === "icon" && (
        <span className="placement-fx__smoke">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="placement-fx__puff"
              style={{ "--puff": i } as CSSProperties}
            />
          ))}
        </span>
      )}
    </span>
  );
}

"use client";

import {
  forceToRating,
  getPlayer,
  type BuildState,
  type SquadCatalog,
  type Vec2,
} from "7a0-engine";
import { STRINGS as S } from "../_data/strings";

/** Engine anchors: x = goal→goal, y = flank. Vertical pitch: attack up, GK bottom. */
const PITCH_EDGE = 0.06;
const PITCH_LIFT = 0.045;
const GK_DROP = 0.08;

function anchorToScreen(anchor: Vec2, position: string): { left: string; top: string } {
  const span = 1 - PITCH_EDGE * 2;
  let depth = 1 - anchor.x;
  if (position === "GK") {
    depth = Math.min(1 - 0.012, depth + GK_DROP);
  }
  return {
    left: `${(PITCH_EDGE + anchor.y * span) * 100}%`,
    top: `${(PITCH_EDGE + depth * span - PITCH_LIFT) * 100}%`,
  };
}

/**
 * Pitch — text-only formation view with absolutely positioned slots (breakdown §/play).
 * Uses engine anchor coordinates; no canvas or WebGL.
 */
export function Pitch({
  catalog,
  buildState,
  highlightSlotId,
  onSlotPick,
}: {
  catalog: SquadCatalog;
  buildState: BuildState;
  highlightSlotId?: string;
  onSlotPick?: (slotId: string) => void;
}) {
  return (
    <div className="pitch" aria-label={S.build.lineup}>
      <div className="pitch__stripes" aria-hidden />
      <div className="pitch__mark">
        <span className="pitch__half" />
        <span className="pitch__circle" />
      </div>
      {buildState.slots.map((slot) => {
        const player = slot.selectedPlayerId
          ? getPlayer(catalog, slot.selectedPlayerId)
          : null;
        const filled = Boolean(player);
        const highlight = highlightSlotId === slot.slotId;
        const Tag = onSlotPick && !filled ? "button" : "div";

        const surname = player?.name.split(" ").pop();

        return (
          <div
            key={slot.slotId}
            className="pitch__token"
            style={anchorToScreen(slot.anchor, slot.position)}
          >
            <Tag
              type={Tag === "button" ? "button" : undefined}
              className={[
                "pitch__slot",
                filled ? "pitch__slot--filled" : "",
                highlight ? "pitch__slot--highlight" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={
                onSlotPick && !filled ? () => onSlotPick(slot.slotId) : undefined
              }
              aria-label={
                filled && player
                  ? `${player.name}, ${slot.position}`
                  : `${slot.position}, ${S.build.empty}`
              }
              title={player?.name}
            >
              {filled && player ? (
                <span className="pitch__num">{forceToRating(player.force)}</span>
              ) : (
                <span className="pitch__pos">{slot.position}</span>
              )}
            </Tag>
            {filled && surname ? (
              <span className="pitch__token-name">{surname}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

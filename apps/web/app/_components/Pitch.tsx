"use client";

import { useMemo, type CSSProperties } from "react";
import {
  getPlayer,
  isLegendPlayer,
  type BuildState,
  type SquadCatalog,
  type Vec2,
} from "7a0-engine";
import { STRINGS as S } from "../_data/strings";
import { PlayerAvatar } from "./PlayerAvatar";

/** Engine anchors: x = goal→goal, y = flank. Vertical pitch: attack up, GK bottom. */
const PITCH_EDGE = 0.06;
const PITCH_LIFT = 0.045;
const GK_DROP = 0.08;
/** Min center distance (~72px on a 380px-wide pitch with 64px slots). */
const MIN_TOKEN_GAP = 0.19;
const POSITION_BOUNDS = {
  min: PITCH_EDGE + 0.03,
  max: 1 - PITCH_EDGE - 0.03,
};

function anchorToNorm(anchor: Vec2, position: string): Vec2 {
  const span = 1 - PITCH_EDGE * 2;
  let depth = 1 - anchor.x;
  if (position === "GK") {
    depth = Math.min(1 - 0.012, depth + GK_DROP);
  }
  return {
    x: PITCH_EDGE + anchor.y * span,
    y: PITCH_EDGE + depth * span - PITCH_LIFT,
  };
}

function normToCss(norm: Vec2): { left: string; top: string } {
  return {
    left: `${norm.x * 100}%`,
    top: `${norm.y * 100}%`,
  };
}

/** Nudge overlapping tokens apart for legibility — display only, not engine anchors. */
function spreadTokenPositions(
  slots: BuildState["slots"],
): Map<string, Vec2> {
  const positions = slots.map((slot) => ({
    slotId: slot.slotId,
    ...anchorToNorm(slot.anchor, slot.position),
  }));

  const clamp = (value: number) =>
    Math.max(POSITION_BOUNDS.min, Math.min(POSITION_BOUNDS.max, value));

  for (let pass = 0; pass < 16; pass++) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i]!;
        const b = positions[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= MIN_TOKEN_GAP || dist < 0.001) continue;

        const push = (MIN_TOKEN_GAP - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  return new Map(
    positions.map((p) => [
      p.slotId,
      { x: clamp(p.x), y: clamp(p.y) },
    ]),
  );
}

/** Broadcast-style pitch markings — vertical, attack up, GK bottom. */
function PitchMarkings() {
  const chalk = "rgba(234, 242, 236, 0.38)";
  const chalkSoft = "rgba(234, 242, 236, 0.22)";
  const len = 1400;

  return (
    <svg
      className="pitch__svg"
      viewBox="0 0 100 133.333"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {/* touchlines */}
      <rect
        className="draw"
        style={{ "--len": `${len}px` } as CSSProperties}
        x="6"
        y="6"
        width="88"
        height="121.333"
        fill="none"
        stroke={chalkSoft}
        strokeWidth="0.55"
      />
      {/* halfway */}
      <line
        className="draw"
        style={{ "--len": "900px" } as CSSProperties}
        x1="6"
        y1="66.667"
        x2="94"
        y2="66.667"
        stroke={chalkSoft}
        strokeWidth="0.5"
      />
      {/* center circle + spot */}
      <circle
        className="draw"
        style={{ "--len": "520px" } as CSSProperties}
        cx="50"
        cy="66.667"
        r="11.5"
        fill="none"
        stroke={chalk}
        strokeWidth="0.65"
      />
      <circle cx="50" cy="66.667" r="0.9" fill={chalk} />
      {/* penalty areas (both ends) */}
      <rect
        className="draw"
        style={{ "--len": "640px" } as CSSProperties}
        x="20.5"
        y="6"
        width="59"
        height="17.5"
        fill="none"
        stroke={chalkSoft}
        strokeWidth="0.5"
      />
      <rect
        className="draw"
        style={{ "--len": "640px" } as CSSProperties}
        x="20.5"
        y="109.833"
        width="59"
        height="17.5"
        fill="none"
        stroke={chalkSoft}
        strokeWidth="0.5"
      />
      {/* goal areas */}
      <rect
        className="draw"
        style={{ "--len": "360px" } as CSSProperties}
        x="36.5"
        y="6"
        width="27"
        height="6"
        fill="none"
        stroke={chalkSoft}
        strokeWidth="0.45"
      />
      <rect
        className="draw"
        style={{ "--len": "360px" } as CSSProperties}
        x="36.5"
        y="115.333"
        width="27"
        height="6"
        fill="none"
        stroke={chalkSoft}
        strokeWidth="0.45"
      />
      {/* penalty spots */}
      <circle cx="50" cy="17.5" r="0.75" fill={chalkSoft} />
      <circle cx="50" cy="115.833" r="0.75" fill={chalkSoft} />
      {/* penalty arcs (clip to outside box) */}
      <path
        className="draw"
        style={{ "--len": "280px" } as CSSProperties}
        d="M 41.2 23.5 A 11.5 11.5 0 0 0 58.8 23.5"
        fill="none"
        stroke={chalkSoft}
        strokeWidth="0.45"
      />
      <path
        className="draw"
        style={{ "--len": "280px" } as CSSProperties}
        d="M 41.2 109.833 A 11.5 11.5 0 0 1 58.8 109.833"
        fill="none"
        stroke={chalkSoft}
        strokeWidth="0.45"
      />
      {/* corner arcs */}
      <path
        className="draw"
        style={{ "--len": "48px" } as CSSProperties}
        d="M 6 8.5 A 2.5 2.5 0 0 0 8.5 6"
        fill="none"
        stroke={chalkSoft}
        strokeWidth="0.45"
      />
      <path
        className="draw"
        style={{ "--len": "48px" } as CSSProperties}
        d="M 91.5 6 A 2.5 2.5 0 0 0 94 8.5"
        fill="none"
        stroke={chalkSoft}
        strokeWidth="0.45"
      />
      <path
        className="draw"
        style={{ "--len": "48px" } as CSSProperties}
        d="M 6 125.333 A 2.5 2.5 0 0 1 8.5 127.333"
        fill="none"
        stroke={chalkSoft}
        strokeWidth="0.45"
      />
      <path
        className="draw"
        style={{ "--len": "48px" } as CSSProperties}
        d="M 91.5 127.333 A 2.5 2.5 0 0 1 94 125.333"
        fill="none"
        stroke={chalkSoft}
        strokeWidth="0.45"
      />
    </svg>
  );
}

/**
 * Pitch — text-only formation view with absolutely positioned slots (breakdown §/play).
 * Uses engine anchor coordinates; no canvas or WebGL.
 */
export function Pitch({
  catalog,
  buildState,
  compatibleSlotIds,
  highlightSlotId,
  onSlotPick,
}: {
  catalog: SquadCatalog;
  buildState: BuildState;
  /** Empty slots where the pending player may be placed. */
  compatibleSlotIds?: readonly string[];
  highlightSlotId?: string;
  onSlotPick?: (slotId: string) => void;
}) {
  const compatible = new Set(compatibleSlotIds ?? []);
  const screenPositions = useMemo(
    () => spreadTokenPositions(buildState.slots),
    [buildState.slots],
  );
  const filledCount = buildState.slots.filter((s) => s.selectedPlayerId).length;

  return (
    <div className="pitch" aria-label={S.build.lineup}>
      <div className="pitch__mark">
        <PitchMarkings />
      </div>
      <div className="pitch__count mono" aria-hidden>
        {S.build.slotsFilled(filledCount)}
      </div>
      {buildState.slots.map((slot) => {
        const player = slot.selectedPlayerId
          ? getPlayer(catalog, slot.selectedPlayerId)
          : null;
        const filled = Boolean(player);
        const isCompatible = !filled && compatible.has(slot.slotId);
        const highlight =
          highlightSlotId === slot.slotId ||
          (isCompatible && compatible.size > 0);
        const clickable = Boolean(
          onSlotPick && !filled && (isCompatible || compatible.size === 0),
        );
        const Tag = clickable ? "button" : "div";
        const pos = screenPositions.get(slot.slotId) ?? anchorToNorm(slot.anchor, slot.position);
        const surname = player?.name.split(" ").pop();
        const meta =
          filled && surname && player ? (
            <>
              <span
                className={[
                  "pitch__token-name",
                  isLegendPlayer(player.name) ? "player-name--legend" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {surname}
              </span>
              <span className="pitch__token-pos">{slot.position}</span>
            </>
          ) : isCompatible ? (
            <span className="pitch__token-pos pitch__token-pos--pick">
              {slot.position}
            </span>
          ) : null;

        return (
          <div
            key={slot.slotId}
            className="pitch__token"
            style={normToCss(pos)}
          >
            <Tag
              type={Tag === "button" ? "button" : undefined}
              className={[
                "pitch__slot",
                filled ? "pitch__slot--filled" : "pitch__slot--empty",
                highlight ? "pitch__slot--highlight" : "",
                isCompatible ? "pitch__slot--compatible" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={clickable ? () => onSlotPick!(slot.slotId) : undefined}
              aria-label={
                filled && player
                  ? `${player.name}, ${slot.position}`
                  : isCompatible
                    ? `${S.build.placeIn(slot.position)}, ${S.build.empty}`
                    : `${slot.position}, ${S.build.empty}`
              }
              title={player?.name}
            >
              {filled && player ? (
                <PlayerAvatar player={player} size="sm" />
              ) : (
                <span className="pitch__pos">{slot.position}</span>
              )}
            </Tag>
            {meta ? <div className="pitch__token-meta">{meta}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

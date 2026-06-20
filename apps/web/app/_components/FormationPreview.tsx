"use client";

import type { FormationDefinition, Vec2 } from "7a0-engine";

const PREVIEW_EDGE = 0.08;
const PREVIEW_LIFT = 0.03;

function previewPos(anchor: Vec2, position: string): { left: string; top: string } {
  const span = 1 - PREVIEW_EDGE * 2;
  let depth = 1 - anchor.x;
  if (position === "GK") {
    depth = Math.min(1 - 0.02, depth + 0.05);
  }
  return {
    left: `${(PREVIEW_EDGE + anchor.y * span) * 100}%`,
    top: `${(PREVIEW_EDGE + depth * span - PREVIEW_LIFT) * 100}%`,
  };
}

/** Mini vertical pitch preview for formation cards. */
export function FormationPreview({
  formation,
}: {
  formation: FormationDefinition;
}) {
  return (
    <div className="form-preview" aria-hidden>
      <div className="form-preview__line form-preview__line--half" />
      <div className="form-preview__circle" />
      {formation.slots.map((slot) => (
        <span
          key={slot.position}
          className="form-preview__dot"
          style={previewPos(slot.anchor, slot.position)}
        />
      ))}
    </div>
  );
}

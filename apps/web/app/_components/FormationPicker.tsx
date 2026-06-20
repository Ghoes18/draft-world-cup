"use client";

import type { FormationDefinition, FormationMentality } from "7a0-engine";
import { FormationPreview } from "./FormationPreview";
import { STRINGS as S } from "../_data/strings";

function mentalityLabel(m: FormationMentality): string {
  return S.formation.mentality[m];
}

export function FormationPicker({
  options,
  selectedId,
  onSelect,
  onConfirm,
}: {
  options: FormationDefinition[];
  selectedId: string | null;
  onSelect: (formationId: string) => void;
  onConfirm: () => void;
}) {
  return (
    <section className="formation-pick panel">
      <div className="panel__head">
        <div>
          <div className="eyebrow">{S.formation.kicker}</div>
          <h2 className="panel__title">{S.formation.heading}</h2>
          <p className="dim formation-pick__hint">{S.formation.hint}</p>
        </div>
      </div>

      <div className="formation-pick__grid" role="listbox" aria-label={S.formation.heading}>
        {options.map((f) => {
          const selected = selectedId === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={[
                "formation-card",
                selected ? "formation-card--selected" : "",
                `formation-card--${f.mentality}`,
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelect(f.id)}
            >
              <FormationPreview formation={f} />
              <span className={`formation-card__tag formation-card__tag--${f.mentality}`}>
                {mentalityLabel(f.mentality)}
              </span>
              <strong className="formation-card__label">{f.label}</strong>
              <span className="formation-card__shape mono dim">{f.baseShape}</span>
              <span className="formation-card__desc">{f.description}</span>
            </button>
          );
        })}
      </div>

      <div className="formation-pick__actions">
        <button
          type="button"
          className="btn-kick"
          disabled={!selectedId}
          onClick={onConfirm}
        >
          {S.formation.confirm}
        </button>
      </div>
    </section>
  );
}

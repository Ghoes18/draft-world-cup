"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormationDefinition, FormationMentality } from "7a0-engine";
import { listFormations } from "7a0-engine";
import { FormationPreview } from "./FormationPreview";
import { useCasinoRoulette } from "../_hooks/useCasinoRoulette";
import { STRINGS as S } from "../_data/strings";

const FORMATION_POOL = listFormations();
const SPIN_MS = 2200;

function getFormationId(f: FormationDefinition): string {
  return f.id;
}

function mentalityLabel(m: FormationMentality): string {
  return S.formation.mentality[m];
}

function FormationSpinCard({
  formationId,
  target,
  spinKey,
  selected,
  onSelect,
  onCardSpin,
}: {
  formationId: string;
  target: FormationDefinition;
  spinKey: string;
  selected: boolean;
  onSelect: () => void;
  onCardSpin: (formationId: string, spinning: boolean) => void;
}) {
  const onCardSpinRef = useRef(onCardSpin);
  onCardSpinRef.current = onCardSpin;

  const { display, spinning } = useCasinoRoulette({
    pool: FORMATION_POOL,
    target,
    spinKey,
    getId: getFormationId,
    durationMs: SPIN_MS,
  });

  useEffect(() => {
    onCardSpinRef.current(formationId, spinning);
  }, [formationId, spinning]);

  const formation = spinning ? display : target;

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={spinning}
      className={[
        "formation-card",
        selected ? "formation-card--selected" : "",
        spinning ? "formation-card--spinning" : "",
        `formation-card--${formation.mentality}`,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onSelect}
    >
      <FormationPreview formation={formation} />
      <span className={`formation-card__tag formation-card__tag--${formation.mentality}`}>
        {mentalityLabel(formation.mentality)}
      </span>
      <strong className="formation-card__label">{formation.label}</strong>
      <span className="formation-card__shape mono dim">{formation.baseShape}</span>
      <span className="formation-card__desc">{formation.description}</span>
    </button>
  );
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
  const spinKey = useMemo(() => options.map((f) => f.id).join("|"), [options]);
  const [spinningCount, setSpinningCount] = useState(0);
  const spinningIds = useRef(new Set<string>());
  const anySpinning = spinningCount > 0;

  useEffect(() => {
    spinningIds.current.clear();
    setSpinningCount(0);
  }, [spinKey]);

  const onCardSpin = useCallback((formationId: string, spinning: boolean) => {
    if (spinning) spinningIds.current.add(formationId);
    else spinningIds.current.delete(formationId);
    setSpinningCount(spinningIds.current.size);
  }, []);

  return (
    <section className={`formation-pick panel${anySpinning ? " formation-pick--spinning" : ""}`}>
      <div className="panel__head">
        <div>
          <div className="eyebrow">{S.formation.kicker}</div>
          <h2 className="panel__title">{S.formation.heading}</h2>
          <p className="dim formation-pick__hint">{S.formation.hint}</p>
        </div>
      </div>

      <div className="formation-pick__grid" role="listbox" aria-label={S.formation.heading}>
        {options.map((f) => (
          <FormationSpinCard
            key={f.id}
            formationId={f.id}
            target={f}
            spinKey={spinKey}
            selected={selectedId === f.id}
            onSelect={() => onSelect(f.id)}
            onCardSpin={onCardSpin}
          />
        ))}
      </div>

      <div className="formation-pick__actions">
        <button
          type="button"
          className="btn-kick"
          disabled={!selectedId || anySpinning}
          onClick={onConfirm}
        >
          {anySpinning ? S.formation.drawing : S.formation.confirm}
        </button>
      </div>
    </section>
  );
}

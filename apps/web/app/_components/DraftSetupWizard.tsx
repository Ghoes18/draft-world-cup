"use client";

import type { ReactNode } from "react";
import { STRINGS as S } from "../_data/strings";

export type DraftSetupStep = 1 | 2 | 3;

const STEPS: readonly { step: DraftSetupStep; label: string }[] = [
  { step: 1, label: S.wizard.name },
  { step: 2, label: S.wizard.formation },
  { step: 3, label: S.wizard.build },
];

const STEP_COUNT = STEPS.length;

function stepState(n: DraftSetupStep, current: DraftSetupStep): "done" | "active" | "pending" {
  if (n < current) return "done";
  if (n === current) return "active";
  return "pending";
}

export function DraftSetupWizard({
  step,
  children,
}: {
  step: DraftSetupStep;
  children: ReactNode;
}) {
  const progressPct =
    STEP_COUNT <= 1 ? 100 : ((step - 1) / (STEP_COUNT - 1)) * 100;

  return (
    <div className="setup-wizard">
      <header className="setup-wizard__header">
        <span className="setup-wizard__phase mono dim">
          {S.wizard.stepOf(step, STEP_COUNT)}
        </span>
        <nav className="setup-wizard__rail" aria-label={S.wizard.label}>
          <div className="setup-wizard__track" aria-hidden>
            <div
              className="setup-wizard__track-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <ol className="setup-wizard__steps">
            {STEPS.map(({ step: n, label }) => {
              const state = stepState(n, step);
              return (
                <li
                  key={n}
                  className={[
                    "setup-wizard__step",
                    `setup-wizard__step--${state}`,
                  ].join(" ")}
                  aria-current={n === step ? "step" : undefined}
                >
                  <span className="setup-wizard__marker mono">
                    {state === "done" ? "✓" : n}
                  </span>
                  <span className="setup-wizard__label">{label}</span>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>
      <div className="setup-wizard__body">{children}</div>
    </div>
  );
}

export function NameSetupStep({
  name,
  onNameChange,
  onContinue,
}: {
  name: string;
  onNameChange: (name: string) => void;
  onContinue: () => void;
}) {
  const trimmed = name.trim();
  const canContinue = trimmed.length > 0;
  const preview = trimmed || "—";

  return (
    <section className="setup-wizard__panel setup-wizard__panel--name panel">
      <div className="setup-wizard__name-stage">
        <div className="setup-wizard__name-copy">
          <div className="eyebrow">{S.wizard.kicker}</div>
          <h2 className="panel__title setup-wizard__name-title">
            {S.wizard.nameHeading}
          </h2>
          <p className="dim setup-wizard__hint">{S.wizard.nameHint}</p>
        </div>

        <div className="setup-wizard__nameplate" aria-live="polite">
          <span className="setup-wizard__nameplate-tag mono">
            {S.wizard.namePreview}
          </span>
          <span className="setup-wizard__nameplate-value">{preview}</span>
          <span className="setup-wizard__nameplate-kit" aria-hidden />
        </div>

        <label className="setup-wizard__field">
          <span className="label">{S.wizard.nameField}</span>
          <input
            className="setup-wizard__input"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canContinue) onContinue();
            }}
            autoComplete="nickname"
            autoFocus
            spellCheck={false}
          />
        </label>
      </div>

      <div className="setup-wizard__actions">
        <button
          type="button"
          className="btn-kick setup-wizard__continue"
          disabled={!canContinue}
          onClick={onContinue}
        >
          {S.wizard.continue}
        </button>
      </div>
    </section>
  );
}

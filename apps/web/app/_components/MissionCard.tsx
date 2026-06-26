import { STRINGS as S } from "../_data/strings";

export interface MissionView {
  id: string;
  type: "daily" | "persistent";
  category: "composition" | "result" | "career";
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
}

/** A single mission: title, blurb, category chip, and a progress meter. */
export function MissionCard({ mission }: { mission: MissionView }) {
  const { title, description, category, progress, target, completed } = mission;
  const pct = target > 0 ? Math.min(100, (progress / target) * 100) : 0;

  return (
    <article
      className={["mission-card", completed ? "mission-card--done" : ""].join(" ").trim()}
      aria-label={title}
    >
      <header className="mission-card__head">
        <span className="mission-card__chip mono">{S.missions.category[category]}</span>
        {completed ? (
          <span className="mission-card__done" aria-label={S.missions.done}>
            ✓ {S.missions.done}
          </span>
        ) : (
          <span className="mission-card__count mono dim">
            {S.missions.progress(progress, target)}
          </span>
        )}
      </header>
      <h3 className="mission-card__title">{title}</h3>
      <p className="mission-card__desc dim">{description}</p>
      <div
        className="mission-card__track"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={target}
      >
        <div className="mission-card__fill" style={{ width: `${pct}%` }} />
      </div>
    </article>
  );
}

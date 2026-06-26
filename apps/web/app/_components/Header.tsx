import { STRINGS as S } from "../_data/strings";

export function Header({ meta }: { meta?: string }) {
  return (
    <header className="topbar">
      <a href="/" className="brand" aria-label={S.title}>
        Ninety<span className="brand__prime">90′</span>
      </a>
      <nav className="topbar__nav" aria-label="Primary">
        <a href="/">{S.nav.play}</a>
        <a href="/missions">{S.nav.missions}</a>
        <a href="/duel">{S.nav.duel}</a>
      </nav>
      <p className="topbar__meta">
        World Cup Draft
        {meta ? (
          <>
            <br />
            {meta}
          </>
        ) : null}
      </p>
    </header>
  );
}

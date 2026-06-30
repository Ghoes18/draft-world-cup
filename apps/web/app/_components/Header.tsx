"use client";

import { useStrings } from "../_i18n/LocaleProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SoundToggle } from "./SoundToggle";
import { AuthControls } from "./AuthControls";

export function Header({ meta }: { meta?: string }) {
  const S = useStrings();

  return (
    <header className="topbar">
      <a href="/" className="brand" aria-label={S.title}>
        {S.brand.name}
        <span className="brand__prime">90′</span>
      </a>
      <nav className="topbar__nav" aria-label="Primary">
        <a href="/">{S.nav.play}</a>
        <a href="/missions">{S.nav.missions}</a>
        <a href="/duel">{S.nav.duel}</a>
        <a href="/leaderboard">{S.nav.leaderboard}</a>
      </nav>
      <div className="topbar__actions">
        <div className="topbar__controls">
          <AuthControls />
          <SoundToggle />
          <LanguageSwitcher />
        </div>
        <p className="topbar__meta">
          <span>{S.brand.tagline}</span>
          {meta ? (
            <span className="topbar__meta-detail">
              {meta}
            </span>
          ) : null}
        </p>
      </div>
    </header>
  );
}

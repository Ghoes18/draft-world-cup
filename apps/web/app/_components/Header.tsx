"use client";

import { usePathname } from "next/navigation";
import { useStrings } from "../_i18n/LocaleProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SoundToggle } from "./SoundToggle";
import { AuthControls } from "./AuthControls";
import { BrandLogo } from "./BrandLogo";

function navIsActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header({ meta }: { meta?: string }) {
  const S = useStrings();
  const pathname = usePathname();

  const links = [
    { href: "/", label: S.nav.play },
    { href: "/missions", label: S.nav.missions },
    { href: "/duel", label: S.nav.duel },
    { href: "/leaderboard", label: S.nav.leaderboard },
  ] as const;

  return (
    <header className="topbar">
      <div className="topbar__main">
        <a href="/" className="brand" aria-label={S.title}>
          <BrandLogo className="brand__logo" />
        </a>

        <nav className="topbar__nav" aria-label="Primary">
          {links.map(({ href, label }) => {
            const active = navIsActive(pathname, href);
            return (
              <a
                key={href}
                href={href}
                className={active ? "topbar__nav-link topbar__nav-link--active" : "topbar__nav-link"}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </a>
            );
          })}
        </nav>

        <div className="topbar__utilities">
          <AuthControls />
          <div className="topbar__utility-rail" aria-label="Preferences">
            <SoundToggle />
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div className="topbar__ticker" aria-live="polite">
        <span className="topbar__ticker-kicker">{S.brand.tagline}</span>
        {meta ? (
          <>
            <span className="topbar__ticker-sep" aria-hidden>
              //
            </span>
            <span className="topbar__ticker-meta">{meta}</span>
          </>
        ) : null}
      </div>
    </header>
  );
}

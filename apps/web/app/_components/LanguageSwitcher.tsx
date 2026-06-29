"use client";

import { useLocale } from "../_i18n/LocaleProvider";
import type { Locale } from "../_i18n/types";

const LABELS: Record<Locale, string> = {
  en: "EN",
  pt: "PT",
  es: "ES",
};

export function LanguageSwitcher() {
  const { locale, setLocale, strings: S } = useLocale();

  return (
    <div className="lang-switch" role="group" aria-label={S.lang.label}>
      {(["en", "pt", "es"] as const).map((code) => (
        <button
          key={code}
          type="button"
          className={["lang-switch__btn", locale === code ? "lang-switch__btn--active" : ""]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}

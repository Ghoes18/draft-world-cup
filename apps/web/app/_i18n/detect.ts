import type { Locale } from "./types";
import { DEFAULT_LOCALE } from "./types";

/** Map an Accept-Language tag to a supported locale. */
function tagToLocale(tag: string): Locale | null {
  const base = tag.split("-")[0]?.toLowerCase();
  if (base === "pt") return "pt";
  if (base === "es") return "es";
  if (base === "en") return "en";
  return null;
}

/** Parse Accept-Language header (q-values respected, highest first). */
export function detectLocaleFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const candidates = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, qPart] = part.trim().split(";q=");
      const q = qPart ? Number.parseFloat(qPart) : 1;
      return { tag: tag ?? "", q: Number.isFinite(q) ? q : 0 };
    })
    .filter((c) => c.tag.length > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of candidates) {
    const locale = tagToLocale(tag);
    if (locale) return locale;
  }

  return DEFAULT_LOCALE;
}

export function parseLocaleCookie(value: string | undefined): Locale | null {
  if (value === "en" || value === "pt" || value === "es") return value;
  return null;
}

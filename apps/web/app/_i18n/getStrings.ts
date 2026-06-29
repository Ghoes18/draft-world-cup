import { en } from "./locales/en";
import { es } from "./locales/es";
import { pt } from "./locales/pt";
import type { Locale, StringCatalog } from "./types";
import { DEFAULT_LOCALE } from "./types";

const CATALOGS: Record<Locale, StringCatalog> = { en, pt, es };

export function getStrings(locale: Locale): StringCatalog {
  return CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE];
}

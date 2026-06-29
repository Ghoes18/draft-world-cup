"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LOCALE_COOKIE, localeCookieOptions } from "./cookie";
import { getStrings } from "./getStrings";
import { parseLocaleCookie } from "./detect";
import type { Locale, StringCatalog } from "./types";
import { DEFAULT_LOCALE } from "./types";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  strings: StringCatalog;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LOCALE_COOKIE}=`));
  if (!match) return null;
  return parseLocaleCookie(match.split("=")[1]);
}

export function LocaleProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return readCookieLocale() ?? initialLocale;
  });

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.cookie = localeCookieOptions(next);
    document.documentElement.lang = next;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      strings: getStrings(locale),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export function useStrings(): StringCatalog {
  return useLocale().strings;
}

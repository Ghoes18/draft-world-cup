import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "../_i18n/cookie";
import { parseLocaleCookie } from "../_i18n/detect";
import { getStrings } from "../_i18n/getStrings";
import type { Locale } from "../_i18n/types";
import { DEFAULT_LOCALE } from "../_i18n/types";

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return parseLocaleCookie(cookieStore.get(LOCALE_COOKIE)?.value) ?? DEFAULT_LOCALE;
}

export async function getServerStrings() {
  const locale = await getServerLocale();
  return { locale, strings: getStrings(locale) };
}

import type { en } from "./locales/en";

export type Locale = "en" | "pt" | "es";

export const LOCALES: readonly Locale[] = ["en", "pt", "es"];

export const DEFAULT_LOCALE: Locale = "en";

type DeepString<T> = T extends (...args: infer A) => string
  ? (...args: A) => string
  : T extends readonly (infer U)[]
    ? readonly DeepString<U>[]
    : T extends object
      ? { [K in keyof T]: DeepString<T[K]> }
      : string;

export type StringCatalog = DeepString<typeof en>;

import { describe, expect, it } from "vitest";
import { en } from "../apps/web/app/_i18n/locales/en";
import { es } from "../apps/web/app/_i18n/locales/es";
import { pt } from "../apps/web/app/_i18n/locales/pt";
import { BOSS_COPY } from "../src/i18n/bosses";
import { MISSION_COPY } from "../src/i18n/missions";
import { BOSS_DEFINITIONS } from "../src/bosses";
import { MISSIONS } from "../src/missions";

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "function") return [prefix || "<root>"];
  if (value === null || typeof value !== "object") return [prefix || "<root>"];
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => leafPaths(item, `${prefix}[${i}]`));
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  if (keys.length === 0) return [prefix || "<root>"];
  return keys.flatMap((key) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return leafPaths(obj[key], next);
  });
}

function fnArity(value: unknown): number | null {
  return typeof value === "function" ? value.length : null;
}

function assertCatalogParity(label: string, other: Record<string, unknown>) {
  const enPaths = new Set(leafPaths(en));
  const otherPaths = new Set(leafPaths(other));
  const missing = [...enPaths].filter((p) => !otherPaths.has(p));
  const extra = [...otherPaths].filter((p) => !enPaths.has(p));
  expect(missing, `${label} missing keys: ${missing.join(", ")}`).toEqual([]);
  expect(extra, `${label} extra keys: ${extra.join(", ")}`).toEqual([]);

  for (const path of enPaths) {
    const enVal = path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object" && key in (acc as object)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, en as unknown);
    const otherVal = path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object" && key in (acc as object)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, other as unknown);
    expect(fnArity(otherVal), `${label} ${path} arity`).toBe(fnArity(enVal));
  }
}

describe("i18n locale catalogs", () => {
  it("pt and es mirror en key structure", () => {
    assertCatalogParity("pt", pt as Record<string, unknown>);
    assertCatalogParity("es", es as Record<string, unknown>);
  });
});

describe("engine mission and boss copy", () => {
  it("covers every mission id in all locales", () => {
    for (const mission of MISSIONS) {
      expect(MISSION_COPY[mission.id], mission.id).toBeDefined();
      expect(MISSION_COPY[mission.id]?.en?.title).toBeTruthy();
      expect(MISSION_COPY[mission.id]?.pt?.title).toBeTruthy();
      expect(MISSION_COPY[mission.id]?.es?.title).toBeTruthy();
    }
  });

  it("covers every boss id in all locales", () => {
    for (const boss of BOSS_DEFINITIONS) {
      expect(BOSS_COPY[boss.id], boss.id).toBeDefined();
      expect(BOSS_COPY[boss.id]?.en?.name).toBeTruthy();
      expect(BOSS_COPY[boss.id]?.pt?.name).toBeTruthy();
      expect(BOSS_COPY[boss.id]?.es?.name).toBeTruthy();
    }
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOSS_DEFINITIONS,
  bossForWeek,
  findBossPlayers,
  hydrateCatalog,
  isLineupComplete,
  resolveBossBuildState,
  resolveBossForWeek,
  validateBuildState,
  type SquadCatalog,
} from "../src/index.js";

function loadGameCatalog(): SquadCatalog {
  const raw = JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, "../apps/web/public/catalog.json"),
      "utf8",
    ),
  ) as SquadCatalog;
  return hydrateCatalog(raw);
}

describe("bossForWeek", () => {
  it("picks deterministically from the ISO week", () => {
    expect(bossForWeek("2026-W26").id).toBe(bossForWeek("2026-W26").id);
    expect(bossForWeek("2026-W26").id).not.toBe(bossForWeek("2026-W27").id);
  });

  it("rotates through the themed catalog", () => {
    const ids = new Set(
      ["2026-W01", "2026-W02", "2026-W03", "2026-W04", "2026-W05"].map(
        (w) => bossForWeek(w).id,
      ),
    );
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe("resolveBossBuildState", () => {
  const catalog = loadGameCatalog();

  it("builds a valid complete XI for every Boss definition", () => {
    for (const definition of BOSS_DEFINITIONS) {
      const state = resolveBossBuildState(catalog, definition, "2026-W10", "away");
      expect(isLineupComplete(state)).toBe(true);
      expect(validateBuildState(catalog, state).ok).toBe(true);
    }
  });

  it("is stable for the same week key and Boss", () => {
    const definition = bossForWeek("2026-W26");
    const a = resolveBossBuildState(catalog, definition, "2026-W26", "away");
    const b = resolveBossBuildState(catalog, definition, "2026-W26", "away");
    expect(a.slots.map((s) => s.selectedPlayerId)).toEqual(
      b.slots.map((s) => s.selectedPlayerId),
    );
  });

  it("includes curated fantasy teams like Best of Brazil", () => {
    const brazil = BOSS_DEFINITIONS.find((b) => b.id === "best-of-brazil");
    expect(brazil).toBeDefined();
    const resolved = resolveBossForWeek(catalog, "2026-W01");
    if (resolved.definition.id === "best-of-brazil") {
      expect(resolved.lineupNames.join(" ")).toMatch(/Ronaldo|Ronaldinho|Cafu/);
    } else {
      const state = resolveBossBuildState(catalog, brazil!, "probe-week");
      const names = state.slots.map(
        (s) => catalog.players[s.selectedPlayerId!]!.name,
      );
      expect(names.join(" ")).toMatch(/Ronaldo|Ronaldinho|Cafu/);
    }
  });
});

describe("findBossPlayers", () => {
  const catalog = loadGameCatalog();

  it("matches legends by surname and prefers higher overall", () => {
    const hits = findBossPlayers(catalog, {
      names: ["Zinedine Zidane", "Zidane"],
      team: "France",
      cupMin: 1998,
      cupMax: 2006,
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.name).toMatch(/Zidane/i);
    expect(hits[0]!.overall).toBeGreaterThanOrEqual(hits.at(-1)!.overall);
  });

  it("falls back to West Germany for Beckenbauer queries tagged Germany", () => {
    const hits = findBossPlayers(catalog, {
      names: ["Franz Beckenbauer", "Beckenbauer"],
      team: "Germany",
      cupMin: 1966,
      cupMax: 1974,
    });
    expect(hits.some((p) => p.team === "West Germany")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  applyLegendPhotosToCatalog,
  isLegendPlayer,
  legendDisplayTier,
  legendEntryForName,
  normalizeLegendName,
} from "../src/legends.js";
import { demoCatalog } from "../src/demoCatalog.js";

describe("legends", () => {
  it("normalizes catalog names", () => {
    expect(normalizeLegendName("not applicable Pelé")).toBe("pele");
    expect(normalizeLegendName("Diego Maradona")).toBe("diegomaradona");
    expect(normalizeLegendName("Julio Musimessi")).toBe("juliomusimessi");
  });

  it("matches legends without false positives", () => {
    expect(isLegendPlayer("not applicable Pelé")).toBe(true);
    expect(isLegendPlayer("Diego Maradona")).toBe(true);
    expect(isLegendPlayer("Lionel Messi")).toBe(true);
    expect(isLegendPlayer("Julio Musimessi")).toBe(false);
    expect(isLegendPlayer("Djamel Zidane")).toBe(false);
    expect(isLegendPlayer("Cristiano Zanetti")).toBe(false);
  });

  it("applies curated photos to legends and keeps elite headshots", () => {
    const catalog = applyLegendPhotosToCatalog(demoCatalog);
    const pele = Object.values(catalog.players).find((p) =>
      normalizeLegendName(p.name).includes("pele"),
    );
    const maradona = catalog.players["ar86-maradona"];
    const felix = Object.values(catalog.players).find((p) =>
      p.name.includes("Félix"),
    );
    expect(pele?.photoUrl).toContain("Pele_con_brasil");
    expect(maradona?.photoUrl).toContain("Maradona_1986_vs_italy");
    expect(maradona?.photoSource).toBe("curated");
    expect(felix?.photoUrl).toBeUndefined();
  });

  it("keeps wikimedia photos for elite non-legends", () => {
    const base = {
      ...demoCatalog,
      players: {
        ...demoCatalog.players,
        "elite-test": {
          id: "elite-test",
          name: "Mario Evaristo",
          team: "Brazil",
          cup: 1930,
          naturalPosition: "FW",
          overall: 86,
          force: 200,
          photoUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/example.jpg",
          photoSource: "wikimedia" as const,
        },
        "gold-test": {
          id: "gold-test",
          name: "Some Guy",
          team: "Brazil",
          cup: 1930,
          naturalPosition: "FW",
          overall: 80,
          force: 180,
          photoUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/gold.jpg",
          photoSource: "wikimedia" as const,
        },
      },
    };
    const catalog = applyLegendPhotosToCatalog(base);
    expect(catalog.players["elite-test"]?.photoUrl).toContain("example.jpg");
    expect(catalog.players["gold-test"]?.photoUrl).toBeUndefined();
  });

  it("resolves legend entry by display alias", () => {
    expect(legendEntryForName("Luís Figo")?.displayName).toBe("Figo");
  });

  it("maps hero ticker names to icon vs legend styling", () => {
    expect(legendDisplayTier("Figo")).toBe("icon");
    expect(legendDisplayTier("Pelé")).toBe("icon");
    expect(legendDisplayTier("Pirlo")).toBe("icon");
    expect(legendDisplayTier("Kroos")).toBe("legend");
    expect(legendDisplayTier("Ibrahimović")).toBe("legend");
    expect(legendDisplayTier("Marcelo")).toBe("legend");
    expect(legendDisplayTier("Chiellini")).toBe("legend");
    expect(legendDisplayTier("Cha Bum-kun")).toBe("legend");
    expect(legendDisplayTier("Messi")).toBe("legend");
    expect(legendDisplayTier("Mbappé")).toBe("legend");
    expect(legendDisplayTier("Modrić")).toBe("legend");
    expect(legendDisplayTier("Neymar")).toBe("legend");
  });

  it("matches newly added legends in the catalog", () => {
    expect(legendEntryForName("Toni Kroos")?.displayName).toBe("Kroos");
    expect(legendEntryForName("Zlatan Ibrahimović")?.displayName).toBe("Ibrahimović");
    expect(legendEntryForName("Marcelo", "Brazil")?.displayName).toBe("Marcelo");
    expect(legendEntryForName("Giorgio Chiellini")?.displayName).toBe("Chiellini");
    expect(legendEntryForName("Bum-kun Cha")?.displayName).toBe("Cha Bum-kun");
  });
});

import { describe, expect, it } from "vitest";
import {
  applyLegendPhotosToCatalog,
  isLegendPlayer,
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

  it("applies photos only to legends", () => {
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

  it("resolves legend entry by display alias", () => {
    expect(legendEntryForName("Luís Figo")?.displayName).toBe("Figo");
  });
});

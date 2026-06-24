import { describe, expect, it } from "vitest";
import { assignSquadDetailPositions } from "../src/catalog/detailPositionsMigrate.js";

describe("assignSquadDetailPositions", () => {
  it("assigns RCB/LCB to two ambiguous centre-backs in shirt order", () => {
    const result = assignSquadDetailPositions([
      {
        name: "A",
        naturalPosition: "CB",
        positions: ["RCB", "LCB", "CB"],
        shirtNumber: 4,
      },
      {
        name: "B",
        naturalPosition: "CB",
        positions: ["RCB", "LCB", "CB"],
        shirtNumber: 5,
      },
    ]);

    expect(result[0]!.naturalPosition).toBe("RCB");
    expect(result[1]!.naturalPosition).toBe("LCB");
  });

  it("preserves side-specific naturals", () => {
    const result = assignSquadDetailPositions([
      {
        name: "Maradona",
        naturalPosition: "LCM",
        positions: ["CAM", "LCM", "LW"],
        shirtNumber: 10,
      },
    ]);

    expect(result[0]!.naturalPosition).toBe("LCM");
    expect(result[0]!.positions).toContain("LW");
  });

  it("rotates ambiguous midfielders when the list has multiple side options", () => {
    const result = assignSquadDetailPositions([
      {
        name: "A",
        naturalPosition: "CM",
        positions: ["CM", "RCM", "LCM"],
        shirtNumber: 6,
      },
      {
        name: "B",
        naturalPosition: "CM",
        positions: ["CM", "RCM", "LCM"],
        shirtNumber: 8,
      },
    ]);

    expect(result[0]!.naturalPosition).toBe("RCM");
    expect(result[1]!.naturalPosition).toBe("LCM");
  });
});

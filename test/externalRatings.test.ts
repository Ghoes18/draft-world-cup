import { describe, expect, it } from "vitest";
import {
  externalRowsToRawExport,
  parseExternalRatingsCsv,
} from "../src/catalog/externalRatings.js";

describe("externalRatings", () => {
  it("parses CSV rows", () => {
    const csv = `name,year,team,overall,positions
Diego Maradona,1986,Argentina,96,CAM/CF/LW
`;
    const rows = parseExternalRatingsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.overall).toBe(96);
    expect(rows[0]!.positions).toEqual(["CAM", "CF", "LW"]);
  });

  it("builds raw export for overlay", () => {
    const raw = externalRowsToRawExport([
      {
        name: "Pelé",
        year: 1970,
        team: "Brazil",
        overall: 95,
        positions: ["ST", "CF"],
      },
    ]);
    expect(raw.scenarios[0]!.id).toBe("brazil-1970");
    expect(raw.scenarios[0]!.players[0]!.overall).toBe(95);
  });
});

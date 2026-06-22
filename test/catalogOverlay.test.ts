import { describe, expect, it } from "vitest";
import { normalizeCatalog } from "../src/catalog.js";
import { overlayRawExportOnCatalog } from "../src/catalog/catalogOverlay.js";

describe("overlayRawExportOnCatalog", () => {
  it("patches curated overall and api positions by name", () => {
    const base = normalizeCatalog({
      scenarios: [
        {
          id: "brazil-1970",
          team: "Brazil",
          cup: 1970,
          players: [
            {
              id: "br70-pele",
              name: "Pelé",
              naturalPosition: "ST",
              force: 200,
              overall: 72,
              positions: ["ST", "CF"],
              positionSource: "inferred",
            },
          ],
        },
      ],
    });

    const { catalog, patched } = overlayRawExportOnCatalog(base, [
      {
        scenarios: [
          {
            id: "brazil-1970",
            team: "Brazil",
            cup: 1970,
            players: [
              {
                id: "curated-pele",
                name: "Pelé",
                naturalPosition: "ST",
                positions: ["ST", "CF", "CAM"],
                positionSource: "api",
                overall: 95,
                force: 245,
              },
            ],
          },
        ],
      },
    ]);

    expect(patched).toBe(1);
    const pele = catalog.players["br70-pele"]!;
    expect(pele.overall).toBe(95);
    expect(pele.positions).toEqual(["ST", "CF", "CAM"]);
    expect(pele.positionSource).toBe("api");
  });

  it("matches Fjelstul names with not applicable prefix", () => {
    const base = normalizeCatalog({
      scenarios: [
        {
          id: "brazil-1970",
          team: "Brazil",
          cup: 1970,
          players: [
            {
              id: "br70-pele",
              name: "not applicable Pelé",
              naturalPosition: "ST",
              force: 200,
              overall: 70,
            },
          ],
        },
      ],
    });

    const { patched } = overlayRawExportOnCatalog(base, [
      {
        scenarios: [
          {
            id: "brazil-1970",
            team: "Brazil",
            cup: 1970,
            players: [
              {
                id: "x",
                name: "Pelé",
                naturalPosition: "ST",
                positions: ["ST", "CF"],
                positionSource: "api",
                overall: 95,
                force: 245,
              },
            ],
          },
        ],
      },
    ]);

    expect(patched).toBe(1);
  });
});

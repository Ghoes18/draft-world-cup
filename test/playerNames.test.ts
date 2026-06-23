import { describe, expect, it } from "vitest";
import {
  cleanPlayerDisplayName,
  playerDisplayNameFromParts,
} from "../src/playerNames.js";
import { hydrateCatalog } from "../src/catalog.js";

describe("playerNames", () => {
  it("strips not applicable prefix from joined names", () => {
    expect(cleanPlayerDisplayName("not applicable Pelé")).toBe("Pelé");
    expect(cleanPlayerDisplayName("Not Applicable Garrincha")).toBe("Garrincha");
  });

  it("builds names from Fjelstul parts, skipping placeholders", () => {
    expect(playerDisplayNameFromParts("not applicable", "Pelé")).toBe("Pelé");
    expect(playerDisplayNameFromParts("Edson", "Pelé")).toBe("Edson Pelé");
    expect(playerDisplayNameFromParts("N/A", "Ronaldinho")).toBe("Ronaldinho");
  });

  it("hydrateCatalog cleans legacy catalog names", () => {
    const catalog = hydrateCatalog({
      scenarios: [
        {
          id: "brazil-1970",
          team: "Brazil",
          cup: 1970,
          playerIds: ["p1"],
        },
      ],
      players: {
        p1: {
          id: "p1",
          name: "not applicable Pelé",
          team: "Brazil",
          cup: 1970,
          naturalPosition: "ST",
          overall: 95,
          force: 240,
        },
      },
    });
    expect(catalog.players.p1!.name).toBe("Pelé");
  });
});

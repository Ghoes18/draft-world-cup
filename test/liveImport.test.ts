import { describe, expect, it } from "vitest";
import {
  decode7a0Force,
  encode7a0Force,
  fnv1aByte,
  normalizeLiveSquadJson,
  overlayLiveSquadsOnCatalog,
} from "../src/catalog/liveImport.js";
import { normalizeCatalog } from "../src/catalog.js";
import {
  parsePlayablePositions,
  parsePlayerOverall,
} from "../src/catalog/livePlayerParse.js";

describe("fnv1aByte", () => {
  it("returns 0–255", () => {
    const b = fnv1aByte("test-player");
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(255);
  });
});

describe("decode7a0Force", () => {
  it("round-trips with encode", () => {
    const id = "player-abc";
    const force = 187;
    const obfuscated = encode7a0Force(id, force);
    expect(decode7a0Force(id, obfuscated)).toBe(force);
  });

  it("is deterministic", () => {
    expect(decode7a0Force("x", 42)).toBe(decode7a0Force("x", 42));
  });
});

describe("livePlayerParse", () => {
  it("parses explicit positions and overall from API row", () => {
    const row = {
      id: "m1",
      name: "Maradona",
      pos: "MEI",
      f: 0,
      overall: 95,
      positions: ["MEI", "PE", "PD"],
    };
    expect(parsePlayablePositions(row)).toEqual(["MEI", "PE", "PD"]);
    expect(parsePlayerOverall(row, 200)).toBe(95);
  });

  it("falls back to single pos when no positions list", () => {
    const row = { id: "s1", name: "Striker", pos: "PE", f: 0 };
    expect(parsePlayablePositions(row)).toEqual(["PE"]);
  });
});

describe("overlayLiveSquadsOnCatalog", () => {
  it("patches API fields onto Fjelstul players by shirt number", () => {
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
              shirtNumber: 10,
              positionSource: "inferred",
              positions: ["ST"],
            },
          ],
        },
      ],
    });

    const id = "live-pele";
    const force = 245;
    const { catalog, patched } = overlayLiveSquadsOnCatalog(base, [
      {
        sel: "Brazil",
        copa: 1970,
        squad: [
          {
            id,
            name: "Pelé",
            pos: "PE",
            f: encode7a0Force(id, force),
            n: 10,
            overall: 94,
            positions: ["PE", "MEI", "PD"],
          },
        ],
      },
    ]);

    expect(patched).toBe(1);
    const player = catalog.players["br70-pele"]!;
    expect(player.overall).toBe(94);
    expect(player.positions).toEqual(["PE", "MEI", "PD"]);
    expect(player.positionSource).toBe("api");
    expect(player.force).toBe(force);
  });
});

describe("normalizeLiveSquadJson", () => {
  it("produces full squad with decoded forces", () => {
    const id = "demo-1";
    const force = 200;
    const f = encode7a0Force(id, force);
    const result = normalizeLiveSquadJson({
      sel: "Brasil",
      copa: 1970,
      squad: [
        { id, name: "Pelé", pos: "PE", f, n: 10 },
        { id: "demo-2", name: "Gerson", pos: "MC", f: encode7a0Force("demo-2", 210), n: 8 },
      ],
    });
    expect(result.scenario.team).toBe("Brasil");
    expect(result.scenario.cup).toBe(1970);
    expect(result.players).toHaveLength(2);
    expect(result.players[0]!.force).toBe(force);
    expect(result.players[0]!.naturalPosition).toBe("PE");
    expect(result.players[0]!.positions).toEqual(["PE"]);
    expect(result.players[0]!.positionSource).toBe("api");
  });

  it("uses API overall and multi-position list when provided", () => {
    const id = "demo-3";
    const result = normalizeLiveSquadJson({
      sel: "Argentina",
      copa: 1986,
      squad: [
        {
          id,
          name: "Maradona",
          pos: "MEI",
          f: encode7a0Force(id, 240),
          overall: 96,
          positions: ["MEI", "PE", "PD"],
        },
      ],
    });
    const player = result.players[0]!;
    expect(player.overall).toBe(96);
    expect(player.positions).toEqual(["MEI", "PE", "PD"]);
    expect(player.positionSource).toBe("api");
  });
});

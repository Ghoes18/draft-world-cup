import { describe, expect, it } from "vitest";
import {
  decode7a0Force,
  encode7a0Force,
  fnv1aByte,
  normalizeLiveSquadJson,
} from "../src/catalog/liveImport.js";

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
  });
});

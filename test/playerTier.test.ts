import { describe, expect, it } from "vitest";
import { playerTier } from "../src/playerTier.js";
import type { PlayerCard } from "../src/catalog.js";

function card(p: Partial<PlayerCard>): PlayerCard {
  return {
    id: "t",
    name: "Player",
    team: "Nowhere",
    cup: 2022,
    naturalPosition: "CM",
    overall: 70,
    force: 140,
    ...p,
  };
}

describe("playerTier", () => {
  it("buckets non-legends by overall, FIFA-style", () => {
    expect(playerTier(card({ overall: 60 }))).toBe("bronze");
    expect(playerTier(card({ overall: 65 }))).toBe("silver");
    expect(playerTier(card({ overall: 74 }))).toBe("silver");
    expect(playerTier(card({ overall: 75 }))).toBe("gold");
    expect(playerTier(card({ overall: 84 }))).toBe("gold");
    expect(playerTier(card({ overall: 85 }))).toBe("elite");
    expect(playerTier(card({ overall: 99 }))).toBe("elite");
  });

  it("treats curated legends as legend/icon regardless of rating", () => {
    // Modern legend → rose treatment.
    expect(playerTier(card({ name: "Lionel Messi", overall: 50 }))).toBe(
      "legend",
    );
    // Retired historical great → icon treatment.
    expect(playerTier(card({ name: "Garrincha", overall: 50 }))).toBe("icon");
    expect(playerTier(card({ name: "Pelé", overall: 99 }))).toBe("icon");
    expect(playerTier(card({ name: "Andrea Pirlo", overall: 90 }))).toBe("icon");
    expect(playerTier(card({ name: "Gianluigi Buffon", overall: 90 }))).toBe(
      "icon",
    );
  });

  it("disambiguates team-scoped legends", () => {
    expect(playerTier(card({ name: "Pepe", team: "Portugal" }))).toBe("icon");
  });
});

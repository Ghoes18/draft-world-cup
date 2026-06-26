import { describe, expect, it } from "vitest";
import {
  bossSeed,
  dailyMissionSeed,
  isoWeekKey,
  utcDateKey,
} from "../src/period.js";

describe("utcDateKey", () => {
  it("formats the UTC calendar day", () => {
    expect(utcDateKey(Date.UTC(2026, 5, 26, 12, 0, 0))).toBe("2026-06-26");
    // Just before UTC midnight stays on the same day; just after rolls over.
    expect(utcDateKey(Date.UTC(2026, 5, 26, 23, 59, 59))).toBe("2026-06-26");
    expect(utcDateKey(Date.UTC(2026, 5, 27, 0, 0, 0))).toBe("2026-06-27");
  });

  it("is deterministic for a given instant", () => {
    const now = Date.UTC(2026, 0, 1, 8);
    expect(utcDateKey(now)).toBe(utcDateKey(now));
  });
});

describe("isoWeekKey", () => {
  it("handles ISO week boundaries (Thursday rule)", () => {
    // 2026-01-01 is a Thursday → week 1 of 2026.
    expect(isoWeekKey(Date.UTC(2026, 0, 1))).toBe("2026-W01");
    // 2021-01-01 is a Friday → belongs to week 53 of 2020.
    expect(isoWeekKey(Date.UTC(2021, 0, 1))).toBe("2020-W53");
    expect(isoWeekKey(Date.UTC(2020, 11, 31))).toBe("2020-W53");
    // 2023-01-01 is a Sunday → week 52 of 2022.
    expect(isoWeekKey(Date.UTC(2023, 0, 1))).toBe("2022-W52");
  });

  it("is stable across a Monday-to-Sunday week", () => {
    // 2026-W26: Mon 2026-06-22 … Sun 2026-06-28.
    for (let d = 22; d <= 28; d++) {
      expect(isoWeekKey(Date.UTC(2026, 5, d, 10))).toBe("2026-W26");
    }
    expect(isoWeekKey(Date.UTC(2026, 5, 29))).not.toBe("2026-W26");
  });
});

describe("seeds", () => {
  it("derive stable strings from period keys", () => {
    expect(bossSeed("2026-W26")).toBe("boss:2026-W26");
    expect(dailyMissionSeed("2026-06-26")).toBe("daily:2026-06-26");
  });
});

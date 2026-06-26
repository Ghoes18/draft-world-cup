/**
 * Calendar period keys + their derived seeds (M6 — Missions & Weekly Boss).
 *
 * Daily missions refresh on the UTC date; the weekly Boss is fixed for the ISO
 * week. Both keys are pure functions of a millisecond timestamp computed in
 * **UTC**, so the server (Convex `Date.now()`) and any client agree on which
 * mission set / Boss is active. The keys also seed the deterministic draws
 * (`bossSeed` → `drawScenario`, `dailyMissionSeed` → `dailyMissions`), keeping
 * the whole feature reproducible from the calendar alone.
 */

/** UTC calendar day, ISO `YYYY-MM-DD` (e.g. `"2026-06-26"`). */
export function utcDateKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * ISO-8601 week key, `YYYY-Www` (e.g. `"2026-W26"`). Weeks start Monday and
 * week 1 is the week containing the year's first Thursday, so the year prefix
 * can differ from the calendar year around New Year — exactly what we want for
 * a stable Monday-to-Sunday Boss.
 */
export function isoWeekKey(now: number = Date.now()): string {
  // Work in UTC; shift to the Thursday of this week to fix the ISO year.
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const thursday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  thursday.setUTCDate(thursday.getUTCDate() - day + 3);
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week =
    1 +
    Math.round(
      (thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000),
    );
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** Server-owned seed for the week's Boss draw. */
export function bossSeed(weekKey: string): string {
  return `boss:${weekKey}`;
}

/** Server-owned seed for selecting the day's rotating missions. */
export function dailyMissionSeed(dateKey: string): string {
  return `daily:${dateKey}`;
}

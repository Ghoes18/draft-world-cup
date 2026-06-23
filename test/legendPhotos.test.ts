import { describe, expect, it } from "vitest";
import { LEGEND_ROSTER } from "../src/legends.js";

function commonsFilename(photoUrl: string): string {
  const raw = photoUrl.split("/Special:FilePath/")[1]?.split("?")[0];
  if (!raw) throw new Error(`Not a Commons thumb URL: ${photoUrl}`);
  return decodeURIComponent(raw);
}

/** Batch-check that legend Commons files still exist (catches renamed/deleted files). */
describe("legend Commons photos", () => {
  it(
    "every legend file exists on Wikimedia Commons",
    async () => {
      const filenames = LEGEND_ROSTER.map((entry) =>
        commonsFilename(entry.photoUrl),
      );
      const titles = filenames.map((f) => `File:${f}`).join("|");
      const url = new URL("https://commons.wikimedia.org/w/api.php");
      url.searchParams.set("action", "query");
      url.searchParams.set("titles", titles);
      url.searchParams.set("format", "json");

      const res = await fetch(url, {
        headers: { "User-Agent": "7a0-engine/legend-photo-check" },
      });
      expect(res.ok).toBe(true);

      const data = (await res.json()) as {
        query: { pages: Record<string, { title?: string; missing?: string }> };
      };

      const missing = Object.values(data.query.pages)
        .filter((page) => "missing" in page)
        .map((page) => page.title?.replace(/^File:/, "") ?? "unknown");

      expect(missing, `Missing Commons files: ${missing.join(", ")}`).toEqual(
        [],
      );
    },
    30_000,
  );
});

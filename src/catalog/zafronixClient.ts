/**
 * Zafronix World Cup API client with optional disk cache.
 *
 * https://api.zafronix.com/docs
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const ZAFRONIX_API_BASE =
  "https://api.zafronix.com/fifa/worldcup/v1";

export interface ZafronixClientOptions {
  apiKey: string;
  cacheDir?: string;
  fetchImpl?: typeof fetch;
}

export interface ZafronixRosterPlayer {
  /** Squad number, or null when the source omits it (resolveRosterJersey infers one). */
  jersey: number | null;
  name: string;
  fullName?: string;
  position: string;
  goals?: number;
  captain?: boolean;
  starter?: boolean;
  minutes?: number;
  appearances?: number;
}

export interface ZafronixTeamEntry {
  name: string;
  finalPosition?: number | null;
  roster: ZafronixRosterPlayer[];
}

export interface ZafronixTournamentMeta {
  year: number;
  champion?: string | null;
  runnerUp?: string | null;
  runner_up?: string | null;
}

export interface ZafronixTournamentDoc {
  tournament?: ZafronixTournamentMeta & Record<string, unknown>;
  teams?: unknown[];
}

export class ZafronixApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "ZafronixApiError";
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function cachePathFor(cacheDir: string, key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return join(cacheDir, `${safe}.json`);
}

export function resolveZafronixApiKey(
  explicit?: string,
  options?: { allowCacheOnly?: boolean },
): string {
  const key = explicit ?? process.env.ZAFRONIX_API_KEY ?? "";
  if (!key.trim()) {
    if (options?.allowCacheOnly) return "cache-only";
    throw new Error(
      "Missing Zafronix API key. Set ZAFRONIX_API_KEY or pass --api-key. Sign up at https://api.zafronix.com/signup",
    );
  }
  return key.trim();
}

export async function zafronixFetchJson<T>(
  options: ZafronixClientOptions,
  path: string,
  cacheKey?: string,
): Promise<T> {
  const cacheDir = options.cacheDir;
  const diskKey = cacheKey ?? path.replace(/\//g, "_");

  if (cacheDir) {
    const file = cachePathFor(cacheDir, diskKey);
    if (await fileExists(file)) {
      const text = await readFile(file, "utf8");
      return JSON.parse(text) as T;
    }
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${ZAFRONIX_API_BASE}${path}`;
  const res = await fetchImpl(url, {
    headers: {
      "X-API-Key": options.apiKey,
      Accept: "application/json",
      "User-Agent": "7a0-engine/0.1.0",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ZafronixApiError(
      `Zafronix API ${res.status} ${res.statusText} on ${path}: ${body.slice(0, 240)}`,
      res.status,
      path,
    );
  }

  const data = (await res.json()) as T;

  if (cacheDir) {
    const file = cachePathFor(cacheDir, diskKey);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data, null, 2), "utf8");
  }

  return data;
}

/** List tournament years (public endpoint — no auth). */
export async function fetchZafronixTournamentYears(
  fetchImpl: typeof fetch = fetch,
): Promise<number[]> {
  const res = await fetchImpl(`${ZAFRONIX_API_BASE}/tournaments`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to list Zafronix tournaments: ${res.status}`);
  }
  const rows = (await res.json()) as Array<{ year: number }>;
  return rows
    .map((r) => r.year)
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);
}

export async function fetchZafronixTournament(
  options: ZafronixClientOptions,
  year: number,
): Promise<ZafronixTournamentDoc> {
  return zafronixFetchJson<ZafronixTournamentDoc>(
    options,
    `/tournaments/${year}`,
    `tournaments_${year}`,
  );
}

export async function fetchZafronixTeamRoster(
  options: ZafronixClientOptions,
  team: string,
  year: number,
): Promise<ZafronixRosterPlayer[]> {
  const data = await zafronixFetchJson<unknown>(
    options,
    `/teams/${encodeURIComponent(team)}/roster?year=${year}`,
    `roster_${year}_${team.replace(/\s+/g, "_")}`,
  );
  if (Array.isArray(data)) return data as ZafronixRosterPlayer[];
  return [];
}

export function getZafronixTournamentMeta(
  doc: ZafronixTournamentDoc,
): ZafronixTournamentMeta {
  const t = (doc.tournament ?? {}) as ZafronixTournamentMeta &
    Record<string, unknown>;
  const year = Number(t.year);
  return {
    year: Number.isFinite(year) ? year : 0,
    champion: typeof t.champion === "string" ? t.champion : null,
    runnerUp:
      typeof t.runnerUp === "string"
        ? t.runnerUp
        : typeof t.runner_up === "string"
          ? t.runner_up
          : null,
  };
}

function rosterFromTeamEntry(entry: Record<string, unknown>): ZafronixRosterPlayer[] {
  const raw = entry.roster ?? entry.squad ?? entry.players;
  if (!Array.isArray(raw)) return [];
  return raw as ZafronixRosterPlayer[];
}

/** Parse team list + rosters from a tournament document. */
export function parseZafronixTournamentTeams(
  doc: ZafronixTournamentDoc,
): ZafronixTeamEntry[] {
  if (!Array.isArray(doc.teams)) return [];

  const teams: ZafronixTeamEntry[] = [];
  for (const item of doc.teams) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const name =
      typeof entry.name === "string"
        ? entry.name
        : typeof entry.team === "string"
          ? entry.team
          : "";
    if (!name) continue;

    const finalPositionRaw =
      entry.finalPosition ?? entry.final_position ?? entry.placement;
    const finalPosition =
      typeof finalPositionRaw === "number" && Number.isFinite(finalPositionRaw)
        ? finalPositionRaw
        : null;

    teams.push({
      name,
      finalPosition,
      roster: rosterFromTeamEntry(entry),
    });
  }

  return teams;
}

const TOURNAMENT_YEARS_CACHE = "tournament-years.json";

async function readCachedTournamentYears(
  cacheDir: string,
): Promise<number[] | null> {
  const file = cachePathFor(cacheDir, TOURNAMENT_YEARS_CACHE);
  if (!(await fileExists(file))) return null;
  const text = await readFile(file, "utf8");
  const parsed = JSON.parse(text) as number[];
  return Array.isArray(parsed) ? parsed : null;
}

async function writeCachedTournamentYears(
  cacheDir: string,
  years: number[],
): Promise<void> {
  const file = cachePathFor(cacheDir, TOURNAMENT_YEARS_CACHE);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(years, null, 2), "utf8");
}

/** Load tournament docs for every year in [fromYear, toYear]. */
export async function loadZafronixTournaments(
  options: ZafronixClientOptions,
  fromYear: number,
  toYear: number,
): Promise<Map<number, ZafronixTournamentDoc>> {
  let years: number[] | null = null;
  if (options.cacheDir) {
    years = await readCachedTournamentYears(options.cacheDir);
  }
  if (!years) {
    years = await fetchZafronixTournamentYears(options.fetchImpl);
    if (options.cacheDir) {
      await writeCachedTournamentYears(options.cacheDir, years);
    }
  }

  const needed = years.filter((y) => y >= fromYear && y <= toYear);
  const map = new Map<number, ZafronixTournamentDoc>();

  for (const year of needed) {
    map.set(year, await fetchZafronixTournament(options, year));
  }

  return map;
}

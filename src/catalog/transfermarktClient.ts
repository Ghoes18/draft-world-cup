/**
 * Transfermarkt API client with optional disk cache.
 *
 * https://transfermarkt-api.fly.dev/docs
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const TRANSFERMARKT_API_BASE =
  "https://transfermarkt-api.fly.dev";

export interface TransfermarktClientOptions {
  cacheDir?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  /** Delay between network requests (ms). Default 250. */
  delayMs?: number;
  /** Abort hung network requests after this many ms. Default 45_000. */
  requestTimeoutMs?: number;
}

export interface TransfermarktPlayerPosition {
  main: string | null;
  other: string[] | null;
}

export interface TransfermarktPlayerProfile {
  id: string;
  name: string;
  fullName?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  citizenship?: string[];
  position: TransfermarktPlayerPosition;
}

export interface TransfermarktPlayerSearchClub {
  id: string;
  name: string;
}

export interface TransfermarktPlayerSearchResult {
  id: string;
  name: string;
  position: string;
  club: TransfermarktPlayerSearchClub;
  age?: number | null;
  nationalities: string[];
}

export interface TransfermarktPlayerSearchResponse {
  query: string;
  pageNumber: number;
  lastPageNumber: number;
  results: TransfermarktPlayerSearchResult[];
}

export interface TransfermarktPlayerProfileResponse extends TransfermarktPlayerProfile {
  updatedAt?: string;
}

export class TransfermarktApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "TransfermarktApiError";
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

let lastRequestAt = 0;

async function throttle(options: TransfermarktClientOptions): Promise<void> {
  const delayMs = options.delayMs ?? 250;
  const now = Date.now();
  const wait = Math.max(0, lastRequestAt + delayMs - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

export async function transfermarktFetchJson<T>(
  options: TransfermarktClientOptions,
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

  await throttle(options);

  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.baseUrl ?? TRANSFERMARKT_API_BASE;
  const url = `${base}${path}`;
  const timeoutMs = options.requestTimeoutMs ?? 45_000;
  const res = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "7a0-engine/0.1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new TransfermarktApiError(
      `Transfermarkt API ${res.status} ${res.statusText} on ${path}: ${body.slice(0, 240)}`,
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

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

/** Search players by name (page 1). */
export async function searchTransfermarktPlayers(
  options: TransfermarktClientOptions,
  playerName: string,
): Promise<TransfermarktPlayerSearchResponse> {
  const encoded = encodePathSegment(playerName);
  return transfermarktFetchJson<TransfermarktPlayerSearchResponse>(
    options,
    `/players/search/${encoded}`,
    `search_${encoded.toLowerCase().replace(/\s+/g, "_")}`,
  );
}

/** Fetch full player profile by Transfermarkt id. */
export async function fetchTransfermarktPlayerProfile(
  options: TransfermarktClientOptions,
  playerId: string,
): Promise<TransfermarktPlayerProfileResponse> {
  const encoded = encodePathSegment(playerId);
  return transfermarktFetchJson<TransfermarktPlayerProfileResponse>(
    options,
    `/players/${encoded}/profile`,
    `profile_${encoded}`,
  );
}

export function defaultTransfermarktCacheDir(): string {
  return "./data/transfermarkt";
}

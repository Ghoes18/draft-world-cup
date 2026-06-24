/**
 * Transfermarkt position overlay — conservative matching + fine position mapping.
 *
 * Only patches inferred catalog players with non-generic Transfermarkt positions.
 * Does not modify overall, force, or existing API/curated position data.
 */

import {
  type PlayerCard,
  type RawCatalogExport,
  type SquadCatalog,
  getPlayer,
  getScenario,
} from "../catalog.js";
import { canonicalRole } from "../chemistry.js";
import { transfermarktLabelToDetail } from "../positionsDetail.js";
import { teamNamesMatch } from "./zafronixImport.js";
import {
  lookupTransfermarktAlias,
  buildTransfermarktSearchQueries,
  type TransfermarktPlayerAlias,
} from "./transfermarktAliases.js";
import {
  fetchTransfermarktPlayerProfile,
  searchTransfermarktPlayers,
  type TransfermarktClientOptions,
  type TransfermarktPlayerProfileResponse,
  type TransfermarktPlayerSearchResponse,
  type TransfermarktPlayerSearchResult,
} from "./transfermarktClient.js";

/** Transfermarkt English labels → internal formation codes (coarse fallback). */
const TRANSFERMARKT_POSITION_MAP: Readonly<Record<string, string>> = {
  goalkeeper: "GK",
  "centre-back": "CB",
  "center-back": "CB",
  "left-back": "LB",
  "right-back": "RB",
  "left wing-back": "LWB",
  "right wing-back": "RWB",
  "defensive midfield": "CDM",
  "central midfield": "CM",
  "attacking midfield": "CAM",
  "left midfield": "LM",
  "right midfield": "RM",
  "left winger": "LW",
  "right winger": "RW",
  "centre-forward": "CF",
  "center-forward": "CF",
  "second striker": "CF",
  sweeper: "CB",
  "left centre-back": "LCB",
  "right centre-back": "RCB",
  "left central midfield": "LCM",
  "right central midfield": "RCM",
};

const GENERIC_TRANSFERMARKT_LABELS = new Set([
  "defender",
  "defence",
  "defense",
  "midfielder",
  "midfield",
  "forward",
  "attack",
  "striker",
  "df",
  "mf",
  "fw",
]);

export type TransfermarktOverlayStatus =
  | "patched"
  | "skipped"
  | "lowConfidence"
  | "ambiguous"
  | "unmatched"
  | "genericPosition";

export interface TransfermarktOverlayEntry {
  playerId: string;
  scenarioId: string;
  catalogName: string;
  transfermarktId?: string;
  transfermarktName?: string;
  confidence: number;
  naturalPosition?: string;
  positions?: string[];
  status: TransfermarktOverlayStatus;
  reason?: string;
}

export interface TransfermarktImportOptions {
  fromYear?: number;
  toYear?: number;
  team?: string;
  limit?: number;
  /** Default true — only players with positionSource inferred or unset coarse lists. */
  onlyInferred?: boolean;
  minConfidence?: number;
  cacheDir?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  delayMs?: number;
  /** Year used to convert search `age` to birth year (default: current UTC year). */
  referenceYear?: number;
  /** Called after each candidate is processed (for CLI progress). */
  onProgress?: (progress: TransfermarktImportProgress) => void;
  /**
   * Skip profile fetch when search match is strong (default true).
   * Cuts ~50% API calls for modern squads; use `--full-profile` to disable.
   */
  skipProfileWhenConfident?: boolean;
  /** Min search confidence to use search-only path. Default 0.80. */
  searchOnlyMinConfidence?: number;
  requestTimeoutMs?: number;
}

export interface TransfermarktImportProgress {
  index: number;
  total: number;
  catalogName: string;
  team: string;
  cup: number;
  status: TransfermarktOverlayStatus;
  /** True while a slow network request is in flight (heartbeat). */
  processing?: boolean;
}

export interface TransfermarktImportReport {
  candidatesConsidered: number;
  patched: number;
  skipped: number;
  lowConfidence: number;
  ambiguous: number;
  unmatched: number;
  genericPosition: number;
  searchOnly: number;
  entries: TransfermarktOverlayEntry[];
  overlay: RawCatalogExport;
}

function normalizeTransfermarktLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Map one Transfermarkt label to a detail position code, or null if generic/unknown. */
export function mapTransfermarktPosition(label: string): string | null {
  const normalized = normalizeTransfermarktLabel(label);
  if (!normalized || GENERIC_TRANSFERMARKT_LABELS.has(normalized)) return null;

  // Prefer detail-level mapping (28 positions)
  const detail = transfermarktLabelToDetail(normalized);
  if (detail) return detail;

  // Fallback to coarse map
  const direct = TRANSFERMARKT_POSITION_MAP[normalized];
  if (direct) return direct;

  // Fallback: already an internal code?
  const upper = label.trim().toUpperCase();
  if (canonicalRole(upper) !== null && !GENERIC_TRANSFERMARKT_LABELS.has(normalized)) {
    return upper;
  }

  return null;
}

export function isGenericTransfermarktLabel(label: string): boolean {
  return mapTransfermarktPosition(label) === null;
}

/** Parse profile position fields into catalog natural + playable list. */
export function parseTransfermarktPositions(
  main: string | null | undefined,
  other: string[] | null | undefined,
): { naturalPosition: string; positions: string[] } | null {
  const labels = [
    ...(main ? [main] : []),
    ...(other ?? []),
  ].filter((l) => l.trim().length > 0);

  const mapped = labels
    .map(mapTransfermarktPosition)
    .filter((code): code is string => code !== null);

  const positions = [...new Set(mapped)];
  if (positions.length === 0) return null;

  const naturalPosition = mapTransfermarktPosition(main ?? positions[0]!) ?? positions[0]!;
  return { naturalPosition, positions };
}

export function normalizeTransfermarktPlayerName(name: string): string {
  return name
    .replace(/^not applicable\s+/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeTransfermarktPlayerName(a);
  const nb = normalizeTransfermarktPlayerName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= 4 && longer.includes(shorter)) return 0.85;

  const aParts = a.toLowerCase().split(/\s+/).filter(Boolean);
  const bParts = b.toLowerCase().split(/\s+/).filter(Boolean);
  const aLast = aParts[aParts.length - 1] ?? "";
  const bLast = bParts[bParts.length - 1] ?? "";
  if (
    aLast &&
    bLast &&
    normalizeTransfermarktPlayerName(aLast) === normalizeTransfermarktPlayerName(bLast) &&
    aParts[0] &&
    bParts[0] &&
    aParts[0]![0] === bParts[0]![0]
  ) {
    return 0.72;
  }

  return 0;
}

function birthYearFromSearchAge(age: number, referenceYear: number): number {
  return referenceYear - age;
}

function birthYearFromIso(date: string | null | undefined): number | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function ageAtCup(
  birthYear: number | null,
  cupYear: number,
): number | null {
  if (birthYear === null) return null;
  return cupYear - birthYear;
}

function nationalityMatchesTeam(
  nationalities: readonly string[],
  team: string,
): boolean {
  if (nationalities.length === 0) return false;
  return nationalities.some((nat) => teamNamesMatch(team, nat));
}

/** Known coarse position blobs (Zafronix templates and empty lists). */
const COARSE_CATALOG_POSITION_SETS: readonly string[][] = [
  ["GK"],
  ["CB", "LB", "RB"],
  ["CM", "CDM", "CAM"],
  ["ST", "CF"],
  [
    "RCB",
    "LCB",
    "CB",
    "RB",
    "LB",
    "RWB",
    "LWB",
  ],
  [
    "RCM",
    "LCM",
    "CM",
    "CM_LEFT",
    "CM_RIGHT",
    "CDM",
    "CDM_DEEP",
    "CAM",
    "RAM",
    "LAM",
    "CAM_LEFT",
    "CAM_RIGHT",
  ],
  ["ST", "RST", "LST", "CF", "CF_FALSE9", "CF_SUPPORT"],
];

function sortedPositionKey(positions: readonly string[]): string {
  return [...new Set(positions.map((p) => p.trim().toUpperCase()))].sort().join(",");
}

/** True when positions are a generic coarse blob, not fine curated data. */
export function isCoarseCatalogPositions(
  positions: readonly string[] | undefined,
): boolean {
  if (!positions?.length) return true;
  const key = sortedPositionKey(positions);
  return COARSE_CATALOG_POSITION_SETS.some(
    (template) => sortedPositionKey(template) === key,
  );
}

function inferredPlayableRoles(player: PlayerCard): Set<string> {
  const roles = new Set<string>();
  const codes =
    player.positions?.length && player.positions.length > 0
      ? player.positions
      : [player.naturalPosition];
  for (const code of codes) {
    const role = canonicalRole(code);
    if (role) roles.add(role);
  }
  return roles;
}

function catalogPlayableRoles(player: PlayerCard): Set<string> {
  if (player.positionSource === "inferred") {
    return inferredPlayableRoles(player);
  }
  if (isCoarseCatalogPositions(player.positions)) {
    const roles = new Set<string>();
    for (const code of player.positions ?? [player.naturalPosition]) {
      const role = canonicalRole(code);
      if (role) roles.add(role);
    }
    return roles;
  }
  return new Set<string>();
}

function filterCompatibleMappedPositions(
  catalogPlayer: PlayerCard,
  mappedCodes: readonly string[],
): string[] {
  if (
    catalogPlayer.positionSource === "inferred" ||
    isCoarseCatalogPositions(catalogPlayer.positions)
  ) {
    return [...mappedCodes];
  }

  const allowed = catalogPlayableRoles(catalogPlayer);
  if (allowed.size > 0) {
    return mappedCodes.filter((code) => {
      const role = canonicalRole(code);
      return role !== null && allowed.has(role);
    });
  }
  return [...mappedCodes];
}

function coarseRoleCompatible(
  catalogPlayer: PlayerCard,
  mappedCodes: readonly string[],
): boolean {
  const compatible = filterCompatibleMappedPositions(catalogPlayer, mappedCodes);
  if (compatible.length === 0) return false;

  if (
    catalogPlayer.positionSource === "inferred" ||
    isCoarseCatalogPositions(catalogPlayer.positions)
  ) {
    return true;
  }

  const catalogRole = canonicalRole(catalogPlayer.naturalPosition);
  if (catalogRole === null) return true;
  return compatible.some((code) => canonicalRole(code) === catalogRole);
}

/** Whether this catalog player is eligible for Transfermarkt position enrichment. */
export function isEligibleForTransfermarktOverlay(
  player: PlayerCard,
  onlyInferred: boolean,
): boolean {
  if (!onlyInferred) return true;
  if (player.positionSource === "inferred") return true;
  if (isCoarseCatalogPositions(player.positions)) return true;
  return false;
}

export interface ScoredTransfermarktCandidate {
  result: TransfermarktPlayerSearchResult;
  confidence: number;
  reasons: string[];
}

/** Score a search hit against a catalog player at a given World Cup edition. */
export function scoreTransfermarktCandidate(
  catalogPlayer: PlayerCard,
  team: string,
  cupYear: number,
  result: TransfermarktPlayerSearchResult,
  profileBirthYear?: number | null,
  referenceYear: number = new Date().getUTCFullYear(),
  expectedBirthYear?: number | null,
): ScoredTransfermarktCandidate {
  const reasons: string[] = [];
  let confidence = 0;

  const nameScore = nameSimilarity(catalogPlayer.name, result.name);
  confidence += nameScore * 0.55;
  if (nameScore >= 0.99) reasons.push("exactName");
  else if (nameScore >= 0.7) reasons.push("partialName");

  const birthYear =
    profileBirthYear ??
    (typeof result.age === "number"
      ? birthYearFromSearchAge(result.age, referenceYear)
      : null);
  const age = ageAtCup(birthYear, cupYear);
  if (age !== null && age >= 17 && age <= 40) {
    confidence += 0.25;
    reasons.push("plausibleAge");
  }

  if (expectedBirthYear != null && birthYear != null) {
    const delta = Math.abs(expectedBirthYear - birthYear);
    if (delta <= 1) {
      confidence += 0.2;
      reasons.push("aliasBirthYear");
    } else if (delta <= 3) {
      confidence += 0.08;
      reasons.push("aliasBirthYearNear");
    } else {
      confidence -= 0.2;
      reasons.push("aliasBirthYearMismatch");
    }
  }

  if (typeof result.age !== "number" && cupYear <= 1980) {
    confidence += 0.12;
    reasons.push("legacyListing");
  }

  if (nationalityMatchesTeam(result.nationalities, team)) {
    confidence += 0.15;
    reasons.push("nationality");
  }

  const mappedSearch = mapTransfermarktPosition(result.position);
  if (mappedSearch && coarseRoleCompatible(catalogPlayer, [mappedSearch])) {
    confidence += 0.05;
    reasons.push("searchPosition");
  }

  return {
    result,
    confidence: Math.max(0, Math.min(1, confidence)),
    reasons,
  };
}

function isAmbiguousSearchMatch(
  catalogPlayer: PlayerCard,
  best: ScoredTransfermarktCandidate,
  second: ScoredTransfermarktCandidate | undefined,
  alias: TransfermarktPlayerAlias | null,
): boolean {
  if (!second) return false;
  if (alias?.transfermarktId === best.result.id) return false;

  const gap = best.confidence - second.confidence;
  if (gap >= 0.08) return false;

  const bestNameScore = nameSimilarity(catalogPlayer.name, best.result.name);
  const secondNameScore = nameSimilarity(catalogPlayer.name, second.result.name);
  if (bestNameScore >= 0.99 && secondNameScore < 0.99) return false;

  return true;
}

function searchResultFromProfile(
  profile: TransfermarktPlayerProfileResponse,
): TransfermarktPlayerSearchResult {
  const clubRecord = profile as TransfermarktPlayerProfileResponse & {
    club?: { lastClubId?: string; lastClubName?: string; name?: string };
  };
  return {
    id: profile.id,
    name: profile.name,
    position: profile.position.main ?? "",
    club: {
      id: clubRecord.club?.lastClubId ?? "0",
      name: clubRecord.club?.lastClubName ?? clubRecord.club?.name ?? "Retired",
    },
    nationalities: profile.citizenship ?? [],
  };
}

async function searchPinnedAliasFallback(
  client: TransfermarktClientOptions,
  alias: TransfermarktPlayerAlias,
): Promise<TransfermarktPlayerSearchResult | null> {
  if (!alias.transfermarktId) return null;

  for (const query of alias.searchQueries ?? []) {
    try {
      const searchResponse = await searchTransfermarktPlayers(client, query);
      const hit = searchResponse.results.find(
        (result) => result.id === alias.transfermarktId,
      );
      if (hit) return hit;
    } catch {
      // Try the next alias query.
    }
  }

  return null;
}

async function resolveTransfermarktSearch(
  client: TransfermarktClientOptions,
  candidate: CatalogCandidate,
): Promise<{
  alias: TransfermarktPlayerAlias | null;
  searchResponse: TransfermarktPlayerSearchResponse | null;
  pinnedResult: TransfermarktPlayerSearchResult | null;
  pinnedProfile: TransfermarktPlayerProfileResponse | null;
}> {
  const alias = lookupTransfermarktAlias(
    candidate.team,
    candidate.cup,
    candidate.player.name,
  );

  if (alias?.transfermarktId) {
    try {
      const profile = await fetchProfileWithRetry(client, alias.transfermarktId);
      return {
        alias,
        searchResponse: null,
        pinnedResult: searchResultFromProfile(profile),
        pinnedProfile: profile,
      };
    } catch {
      const fallback = await searchPinnedAliasFallback(client, alias);
      if (fallback) {
        return {
          alias,
          searchResponse: null,
          pinnedResult: fallback,
          pinnedProfile: null,
        };
      }
    }
  }

  const queries = buildTransfermarktSearchQueries(
    candidate.player.name,
    candidate.team,
    candidate.cup,
  );

  for (const query of queries) {
    try {
      const searchResponse = await searchTransfermarktPlayers(client, query);
      if (searchResponse.results.length > 0) {
        return {
          alias,
          searchResponse,
          pinnedResult: null,
          pinnedProfile: null,
        };
      }
    } catch {
      // Try the next alias/default query.
    }
  }

  return {
    alias,
    searchResponse: { query: queries[0] ?? "", pageNumber: 1, lastPageNumber: 1, results: [] },
    pinnedResult: null,
    pinnedProfile: null,
  };
}

async function fetchProfileWithRetry(
  client: ReturnType<typeof clientOptionsFromImport>,
  playerId: string,
): Promise<Awaited<ReturnType<typeof fetchTransfermarktPlayerProfile>>> {
  try {
    return await fetchTransfermarktPlayerProfile(client, playerId);
  } catch (firstError) {
    try {
      return await fetchTransfermarktPlayerProfile(client, playerId);
    } catch {
      throw firstError;
    }
  }
}

function parsePositionsFromProfileOrSearch(
  profile: Awaited<ReturnType<typeof fetchTransfermarktPlayerProfile>> | null,
  searchResult: TransfermarktPlayerSearchResult,
): { naturalPosition: string; positions: string[] } | null {
  if (profile) {
    return parseTransfermarktPositions(
      profile.position.main,
      profile.position.other,
    );
  }
  return parseTransfermarktPositions(searchResult.position, null);
}

function clientOptionsFromImport(
  options: TransfermarktImportOptions,
): TransfermarktClientOptions {
  return {
    ...(options.cacheDir !== undefined ? { cacheDir: options.cacheDir } : {}),
    ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
    ...(options.baseUrl !== undefined ? { baseUrl: options.baseUrl } : {}),
    ...(options.delayMs !== undefined ? { delayMs: options.delayMs } : {}),
    ...(options.requestTimeoutMs !== undefined
      ? { requestTimeoutMs: options.requestTimeoutMs }
      : {}),
  };
}

/** Strong search hit — skip slow profile fetch and use search position. */
function shouldSkipProfileFetch(
  options: TransfermarktImportOptions,
  candidate: CatalogCandidate,
  best: ScoredTransfermarktCandidate,
  referenceYear: number,
): boolean {
  if (options.skipProfileWhenConfident === false) return false;

  const minConfidence = options.searchOnlyMinConfidence ?? 0.8;
  if (best.confidence < minConfidence) return false;
  if (nameSimilarity(candidate.player.name, best.result.name) < 0.99) return false;
  if (mapTransfermarktPosition(best.result.position) === null) return false;
  if (!nationalityMatchesTeam(best.result.nationalities, candidate.team)) return false;

  if (candidate.cup >= 1990) return true;

  const birthYear =
    typeof best.result.age === "number"
      ? birthYearFromSearchAge(best.result.age, referenceYear)
      : null;
  const age = ageAtCup(birthYear, candidate.cup);
  return age !== null && age >= 17 && age <= 40;
}

interface CatalogCandidate {
  scenarioId: string;
  team: string;
  cup: number;
  playerId: string;
  player: PlayerCard;
}

function collectCandidates(
  catalog: SquadCatalog,
  options: TransfermarktImportOptions,
): CatalogCandidate[] {
  const fromYear = options.fromYear ?? 1930;
  const toYear = options.toYear ?? 2022;
  const onlyInferred = options.onlyInferred ?? true;
  const teamFilter = options.team?.trim();

  const candidates: CatalogCandidate[] = [];

  for (const scenario of catalog.scenarios) {
    if (scenario.cup < fromYear || scenario.cup > toYear) continue;
    if (teamFilter && !teamNamesMatch(scenario.team, teamFilter)) continue;

    for (const playerId of scenario.playerIds) {
      const player = getPlayer(catalog, playerId);
      if (!isEligibleForTransfermarktOverlay(player, onlyInferred)) continue;
      candidates.push({
        scenarioId: scenario.id,
        team: scenario.team,
        cup: scenario.cup,
        playerId,
        player,
      });
    }
  }

  candidates.sort(
    (a, b) => a.cup - b.cup || a.team.localeCompare(b.team) || a.player.name.localeCompare(b.player.name),
  );

  if (typeof options.limit === "number" && options.limit > 0) {
    return candidates.slice(0, options.limit);
  }
  return candidates;
}

function rawPlayerFromEntry(
  entry: TransfermarktOverlayEntry,
  team: string,
  cup: number,
): RawCatalogExport["scenarios"][number]["players"][number] | null {
  if (
    entry.status !== "patched" ||
    !entry.naturalPosition ||
    !entry.positions?.length
  ) {
    return null;
  }
  return {
    id: entry.playerId,
    name: entry.catalogName,
    naturalPosition: entry.naturalPosition,
    positions: entry.positions,
    positionSource: "api",
    force: 0,
  };
}

/** Build overlay + report by querying Transfermarkt (with cache). */
export async function buildTransfermarktPositionOverlay(
  catalog: SquadCatalog,
  options: TransfermarktImportOptions = {},
): Promise<TransfermarktImportReport> {
  const minConfidence = options.minConfidence ?? 0.72;
  const client = clientOptionsFromImport(options);
  const referenceYear = options.referenceYear ?? new Date().getUTCFullYear();
  const candidates = collectCandidates(catalog, options);

  const delayMs = options.delayMs ?? 250;
  if (candidates.length > 0 && options.onProgress) {
    const estMinutes = Math.max(
      1,
      Math.round((candidates.length * 2 * delayMs) / 60_000),
    );
    console.error(
      `Transfermarkt overlay: ${candidates.length} candidates (~${estMinutes}+ min; cache hits are faster).`,
    );
  }

  const entries: TransfermarktOverlayEntry[] = [];
  const overlayPlayersByScenario = new Map<
    string,
    RawCatalogExport["scenarios"][number]
  >();

  let patched = 0;
  let skipped = 0;
  let lowConfidence = 0;
  let ambiguous = 0;
  let unmatched = 0;
  let genericPosition = 0;
  let searchOnly = 0;

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index]!;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    if (options.onProgress) {
      heartbeat = setInterval(() => {
        options.onProgress?.({
          index: index + 1,
          total: candidates.length,
          catalogName: candidate.player.name,
          team: candidate.team,
          cup: candidate.cup,
          status: "unmatched",
          processing: true,
        });
      }, 20_000);
    }
    try {
    const baseEntry: TransfermarktOverlayEntry = {
      playerId: candidate.playerId,
      scenarioId: candidate.scenarioId,
      catalogName: candidate.player.name,
      confidence: 0,
      status: "unmatched",
    };

    const alias = lookupTransfermarktAlias(
      candidate.team,
      candidate.cup,
      candidate.player.name,
    );

    if (alias?.skip) {
      skipped++;
      entries.push({
        ...baseEntry,
        status: "skipped",
        reason: "aliasSkip",
      });
      continue;
    }

    let pinnedProfile: TransfermarktPlayerProfileResponse | null = null;
    let searchResponse: TransfermarktPlayerSearchResponse | null = null;
    let pinnedResult: TransfermarktPlayerSearchResult | null = null;

    try {
      const resolved = await resolveTransfermarktSearch(client, candidate);
      pinnedProfile = resolved.pinnedProfile;
      searchResponse = resolved.searchResponse;
      pinnedResult = resolved.pinnedResult;
    } catch (error) {
      unmatched++;
      entries.push({
        ...baseEntry,
        status: "unmatched",
        reason: error instanceof Error ? error.message : "searchFailed",
      });
      continue;
    }

    if (!pinnedResult && (!searchResponse || searchResponse.results.length === 0)) {
      unmatched++;
      entries.push({ ...baseEntry, status: "unmatched", reason: "noSearchResults" });
      continue;
    }

    const expectedBirthYear = alias?.birthYear ?? null;
    const scored = pinnedResult
      ? [
          {
            result: pinnedResult,
            confidence: 1,
            reasons: ["pinnedAlias"],
          } satisfies ScoredTransfermarktCandidate,
        ]
      : searchResponse!.results
          .slice(0, 5)
          .map((result) =>
            scoreTransfermarktCandidate(
              candidate.player,
              candidate.team,
              candidate.cup,
              result,
              null,
              referenceYear,
              expectedBirthYear,
            ),
          )
          .sort((a, b) => b.confidence - a.confidence);

    const best = scored[0]!;
    const second = scored[1];

    if (!pinnedResult && best.confidence < 0.35) {
      lowConfidence++;
      entries.push({
        ...baseEntry,
        transfermarktId: best.result.id,
        transfermarktName: best.result.name,
        confidence: best.confidence,
        status: "lowConfidence",
        reason: `weakSearchMatch=${best.confidence.toFixed(2)}`,
      });
      continue;
    }

    if (!pinnedResult && isAmbiguousSearchMatch(candidate.player, best, second, alias)) {
      ambiguous++;
      entries.push({
        ...baseEntry,
        transfermarktId: best.result.id,
        transfermarktName: best.result.name,
        confidence: best.confidence,
        status: "ambiguous",
        reason: `gap=${((second?.confidence ?? 0) > 0 ? best.confidence - second!.confidence : 0).toFixed(2)}`,
      });
      continue;
    }

    let profile: TransfermarktPlayerProfileResponse | null = pinnedProfile;
    let usedSearchFallback = false;
    if (
      !profile &&
      shouldSkipProfileFetch(options, candidate, best, referenceYear)
    ) {
      usedSearchFallback = true;
      searchOnly++;
    } else if (!profile) {
      try {
        profile = await fetchProfileWithRetry(client, best.result.id);
      } catch (error) {
        const exactNameMatch =
          nameSimilarity(candidate.player.name, best.result.name) >= 0.99;
        const aliasFallback =
          alias?.transfermarktId === best.result.id
            ? await searchPinnedAliasFallback(client, alias)
            : null;

        if (aliasFallback) {
          best.result = aliasFallback;
          usedSearchFallback = true;
        } else if (exactNameMatch) {
          usedSearchFallback = true;
        } else {
          unmatched++;
          entries.push({
            ...baseEntry,
            transfermarktId: best.result.id,
            transfermarktName: best.result.name,
            confidence: best.confidence,
            status: "unmatched",
            reason: error instanceof Error ? error.message : "profileFailed",
          });
          continue;
        }
      }
    }

    const profileBirthYear = profile
      ? birthYearFromIso(profile.dateOfBirth)
      : (alias?.birthYear ?? null);
    const rescored = scoreTransfermarktCandidate(
      candidate.player,
      candidate.team,
      candidate.cup,
      best.result,
      profileBirthYear,
      referenceYear,
      expectedBirthYear,
    );

    if (rescored.confidence < minConfidence) {
      const trustedPinnedAlias =
        alias?.transfermarktId === best.result.id &&
        (pinnedResult !== null || usedSearchFallback);
      if (!trustedPinnedAlias) {
        lowConfidence++;
        entries.push({
          ...baseEntry,
          transfermarktId: best.result.id,
          transfermarktName: profile?.name ?? best.result.name,
          confidence: rescored.confidence,
          status: "lowConfidence",
          reason: usedSearchFallback
            ? "searchFallbackBelowMin"
            : "profileRescoreBelowMin",
        });
        continue;
      }
    }

    const parsed = parsePositionsFromProfileOrSearch(profile, best.result);

    if (!parsed) {
      genericPosition++;
      entries.push({
        ...baseEntry,
        transfermarktId: best.result.id,
        transfermarktName: profile?.name ?? best.result.name,
        confidence: rescored.confidence,
        status: "genericPosition",
        reason: profile?.position.main ?? best.result.position ?? "noFinePositions",
      });
      continue;
    }

    const compatiblePositions = filterCompatibleMappedPositions(
      candidate.player,
      parsed.positions,
    );

    if (compatiblePositions.length === 0) {
      skipped++;
      entries.push({
        ...baseEntry,
        transfermarktId: best.result.id,
        transfermarktName: profile?.name ?? best.result.name,
        confidence: rescored.confidence,
        status: "skipped",
        reason: "roleMismatch",
      });
      continue;
    }

    const naturalPosition = compatiblePositions.includes(parsed.naturalPosition)
      ? parsed.naturalPosition
      : compatiblePositions[0]!;

    const finalParsed = {
      naturalPosition,
      positions: compatiblePositions,
    };

    if (!coarseRoleCompatible(candidate.player, finalParsed.positions)) {
      skipped++;
      entries.push({
        ...baseEntry,
        transfermarktId: best.result.id,
        transfermarktName: profile?.name ?? best.result.name,
        confidence: rescored.confidence,
        status: "skipped",
        reason: "roleMismatch",
      });
      continue;
    }

    patched++;
    const entry: TransfermarktOverlayEntry = {
      ...baseEntry,
      transfermarktId: best.result.id,
      transfermarktName: profile?.name ?? best.result.name,
      confidence: rescored.confidence,
      naturalPosition: finalParsed.naturalPosition,
      positions: finalParsed.positions,
      status: "patched",
    };
    entries.push(entry);

    const rawPlayer = rawPlayerFromEntry(entry, candidate.team, candidate.cup);
    if (!rawPlayer) continue;

    const scenarioOverlay = overlayPlayersByScenario.get(candidate.scenarioId) ?? {
      id: candidate.scenarioId,
      team: candidate.team,
      cup: candidate.cup,
      players: [],
    };
    scenarioOverlay.players.push(rawPlayer);
    overlayPlayersByScenario.set(candidate.scenarioId, scenarioOverlay);
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      const last = entries[entries.length - 1];
      if (last?.playerId === candidate.playerId) {
        options.onProgress?.({
          index: index + 1,
          total: candidates.length,
          catalogName: candidate.player.name,
          team: candidate.team,
          cup: candidate.cup,
          status: last.status,
        });
      }
    }
  }

  return {
    candidatesConsidered: candidates.length,
    patched,
    skipped,
    lowConfidence,
    ambiguous,
    unmatched,
    genericPosition,
    searchOnly,
    entries,
    overlay: {
      scenarios: [...overlayPlayersByScenario.values()].sort(
        (a, b) => a.cup - b.cup || a.team.localeCompare(b.team),
      ),
    },
  };
}

/** Apply Transfermarkt overlay — positions only; never overwrites overall/force or API players. */
export function applyTransfermarktPositionOverlay(
  catalog: SquadCatalog,
  overlay: RawCatalogExport,
): { catalog: SquadCatalog; patched: number; skipped: number } {
  const players: Record<string, PlayerCard> = { ...catalog.players };
  let patched = 0;
  let skipped = 0;

  for (const scenario of overlay.scenarios) {
    if (!catalog.scenarios.some((s) => s.id === scenario.id)) {
      skipped += scenario.players.length;
      continue;
    }

    for (const row of scenario.players) {
      const existing = players[row.id];
      if (!existing) {
        skipped++;
        continue;
      }

      if (
        existing.positionSource === "api" &&
        !isCoarseCatalogPositions(existing.positions)
      ) {
        skipped++;
        continue;
      }

      if (!row.positions?.length) {
        skipped++;
        continue;
      }

      players[row.id] = {
        ...existing,
        naturalPosition: row.naturalPosition,
        positions: row.positions,
        positionSource: "api",
      };
      patched++;
    }
  }

  return { catalog: { scenarios: catalog.scenarios, players }, patched, skipped };
}

/** Resolve scenario team/cup for report entries. */
export function scenarioMetaForId(
  catalog: SquadCatalog,
  scenarioId: string,
): { team: string; cup: number } {
  const scenario = getScenario(catalog, scenarioId);
  return { team: scenario.team, cup: scenario.cup };
}

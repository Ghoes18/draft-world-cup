/**
 * Match catalog players to Wikidata entities and resolve Commons headshot URLs.
 */

import type { PlayerCard, SquadCatalog } from "../catalog.js";
import {
  commonsThumbUrl,
  photoIsProtected,
  type PhotoSource,
} from "../playerPhoto.js";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const FOOTBALL_PLAYER_QID = "Q937857";

export interface PhotoCacheEntry {
  photoUrl: string;
  photoSource: PhotoSource;
  wikidataId?: string;
}

export interface PhotoCache {
  byPlayerId: Record<string, PhotoCacheEntry>;
}

export interface PhotoLookupResult {
  photoUrl: string;
  photoSource: "wikimedia";
  wikidataId: string;
}

export interface WikimediaLookupOptions {
  fetch?: typeof fetch;
  /** Delay between Wikidata API calls (ms). */
  delayMs?: number;
}

function normalizePlayerName(name: string): string {
  return name
    .replace(/^not applicable\s+/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function claimEntityIds(claim: unknown): string[] {
  if (!claim || typeof claim !== "object") return [];
  const mainsnak = (claim as { mainsnak?: { datavalue?: { value?: unknown } } })
    .mainsnak;
  const value = mainsnak?.datavalue?.value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return [String((value as { id: string }).id)];
  }
  if (Array.isArray(value)) {
    return value
      .map((v) =>
        typeof v === "object" && v !== null && "id" in v
          ? String((v as { id: string }).id)
          : null,
      )
      .filter((id): id is string => Boolean(id));
  }
  return [];
}

function claimImageFilename(claim: unknown): string | null {
  if (!claim || typeof claim !== "object") return null;
  const mainsnak = (claim as { mainsnak?: { datavalue?: { value?: string } } })
    .mainsnak;
  const value = mainsnak?.datavalue?.value;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

interface WikidataSearchHit {
  id: string;
  label: string;
  description?: string | undefined;
}

interface WikidataEntity {
  id: string;
  claims?: {
    P106?: unknown[];
    P18?: unknown[];
  };
  labels?: Record<string, { value: string }>;
}

async function wikidataSearch(
  fetchFn: typeof fetch,
  query: string,
): Promise<WikidataSearchHit[]> {
  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("search", query);
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("limit", "8");

  const res = await fetchFn(url.toString());
  if (!res.ok) throw new Error(`Wikidata search failed: ${res.status}`);
  const json = (await res.json()) as {
    search?: Array<{ id: string; label: string; description?: string }>;
  };
  return (json.search ?? []).map((hit) => ({
    id: hit.id,
    label: hit.label,
    description: hit.description,
  }));
}

async function wikidataGetEntities(
  fetchFn: typeof fetch,
  ids: readonly string[],
): Promise<Record<string, WikidataEntity>> {
  if (ids.length === 0) return {};
  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", ids.join("|"));
  url.searchParams.set("props", "claims|labels");
  url.searchParams.set("languages", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const res = await fetchFn(url.toString());
  if (!res.ok) throw new Error(`Wikidata getentities failed: ${res.status}`);
  const json = (await res.json()) as { entities?: Record<string, WikidataEntity> };
  return json.entities ?? {};
}

function scoreCandidate(
  playerName: string,
  entity: WikidataEntity,
  hitLabel: string,
): number {
  let score = 0;
  const normPlayer = normalizePlayerName(playerName);
  const normLabel = normalizePlayerName(hitLabel);
  const normEntity = normalizePlayerName(entity.labels?.en?.value ?? hitLabel);

  if (normLabel === normPlayer || normEntity === normPlayer) score += 30;
  else if (normLabel.includes(normPlayer) || normPlayer.includes(normLabel)) {
    score += 12;
  }

  const occupations = (entity.claims?.P106 ?? []).flatMap(claimEntityIds);
  if (occupations.includes(FOOTBALL_PLAYER_QID)) score += 15;

  const image = (entity.claims?.P18 ?? [])
    .map(claimImageFilename)
    .find(Boolean);
  if (image) score += 20;

  return score;
}

/** Resolve a Commons thumbnail for one player name via Wikidata search. */
export async function lookupWikimediaPhoto(
  name: string,
  _team: string,
  options: WikimediaLookupOptions = {},
): Promise<PhotoLookupResult | null> {
  const fetchFn = options.fetch ?? fetch;
  const searchName = name.replace(/^not applicable\s+/i, "").trim();
  if (!searchName) return null;

  const hits = await wikidataSearch(fetchFn, searchName);
  if (hits.length === 0) return null;

  const entities = await wikidataGetEntities(
    fetchFn,
    hits.map((h) => h.id),
  );

  let best: { id: string; score: number; image: string } | null = null;

  for (const hit of hits) {
    const entity = entities[hit.id];
    if (!entity || entity.id === "-1") continue;
    const score = scoreCandidate(searchName, entity, hit.label);
    const image = (entity.claims?.P18 ?? [])
      .map(claimImageFilename)
      .find(Boolean);
    if (!image || score < 20) continue;
    if (!best || score > best.score) {
      best = { id: hit.id, score, image };
    }
  }

  if (!best) return null;

  return {
    photoUrl: commonsThumbUrl(best.image),
    photoSource: "wikimedia",
    wikidataId: best.id,
  };
}

export interface MergePhotosResult {
  catalog: SquadCatalog;
  matched: number;
  skipped: number;
  protected: number;
  failed: number;
}

export interface MergePhotosOptions {
  cache: PhotoCache;
  force?: boolean;
  limit?: number;
  dryRun?: boolean;
  fetch?: typeof fetch;
  delayMs?: number;
  onProgress?: (done: number, total: number, player: PlayerCard) => void;
}

/** Apply cached / freshly looked-up photos onto catalog players. */
export async function mergePhotosIntoCatalog(
  catalog: SquadCatalog,
  options: MergePhotosOptions,
): Promise<MergePhotosResult> {
  const fetchFn = options.fetch ?? fetch;
  const delayMs = options.delayMs ?? 200;
  const players: Record<string, PlayerCard> = { ...catalog.players };
  const cache = { ...options.cache, byPlayerId: { ...options.cache.byPlayerId } };

  const candidates = Object.values(catalog.players).filter((p) => {
    if (photoIsProtected(p.photoSource) && p.photoUrl) return false;
    if (p.photoUrl && p.photoSource === "wikimedia" && !options.force) {
      return false;
    }
    if (cache.byPlayerId[p.id] && !options.force) return true;
    return !p.photoUrl || options.force;
  });

  const toProcess =
    options.limit !== undefined
      ? candidates.slice(0, options.limit)
      : candidates;

  let matched = 0;
  let skipped = 0;
  let protectedCount = 0;
  let failed = 0;

  for (const [idx, player] of toProcess.entries()) {
    options.onProgress?.(idx + 1, toProcess.length, player);

    if (photoIsProtected(player.photoSource) && player.photoUrl) {
      protectedCount++;
      continue;
    }

    const cached = cache.byPlayerId[player.id];
    if (cached && !options.force) {
      if (!options.dryRun) {
        players[player.id] = {
          ...player,
          photoUrl: cached.photoUrl,
          photoSource: cached.photoSource,
        };
      }
      matched++;
      continue;
    }

    try {
      const result = await lookupWikimediaPhoto(player.name, player.team, {
        fetch: fetchFn,
      });
      if (!result) {
        skipped++;
        await sleep(delayMs);
        continue;
      }

      if (!options.dryRun) {
        players[player.id] = {
          ...player,
          photoUrl: result.photoUrl,
          photoSource: result.photoSource,
        };
        cache.byPlayerId[player.id] = {
          photoUrl: result.photoUrl,
          photoSource: result.photoSource,
          wikidataId: result.wikidataId,
        };
      }
      matched++;
    } catch {
      failed++;
    }

    await sleep(delayMs);
  }

  return {
    catalog: { scenarios: catalog.scenarios, players },
    matched,
    skipped,
    protected: protectedCount,
    failed,
  };
}

export function emptyPhotoCache(): PhotoCache {
  return { byPlayerId: {} };
}

export function parsePhotoCache(json: unknown): PhotoCache {
  if (!json || typeof json !== "object") return emptyPhotoCache();
  const byPlayerId = (json as PhotoCache).byPlayerId;
  if (!byPlayerId || typeof byPlayerId !== "object") return emptyPhotoCache();
  return { byPlayerId: { ...byPlayerId } };
}

export { normalizePlayerName };

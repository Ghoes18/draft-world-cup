/**
 * Manual Transfermarkt lookup hints for nicknames and ambiguous historical players.
 * Keys: `${team}::${cup}::${normalizedCatalogName}`
 */

export interface TransfermarktPlayerAlias {
  /** Search queries tried in order before the default query. */
  searchQueries?: readonly string[];
  /** Skip Transfermarkt lookup entirely for this catalog player. */
  skip?: boolean;
  /** Skip search and fetch this Transfermarkt player id directly. */
  transfermarktId?: string;
  /** Expected birth year for disambiguation at historical World Cups. */
  birthYear?: number;
}

const ALIASES: Readonly<Record<string, TransfermarktPlayerAlias>> = {
  "brazil::1970::ado": {
    skip: true,
  },
  "brazil::1970::caju": {
    searchQueries: ["Paulo César"],
    transfermarktId: "145513",
    birthYear: 1949,
  },
  "brazil::1970::carlosalberto": {
    searchQueries: ["Carlos Alberto Torres"],
    transfermarktId: "229662",
    birthYear: 1944,
  },
  "brazil::1970::dario": {
    searchQueries: ["Dada Maravilha"],
    transfermarktId: "290259",
    birthYear: 1946,
  },
  "brazil::1970::edu": {
    skip: true,
  },
  "brazil::1970::everaldo": {
    transfermarktId: "229673",
  },
  "brazil::1970::fontana": {
    transfermarktId: "229674",
  },
  "brazil::1970::jairzinho": {
    transfermarktId: "145510",
    birthYear: 1944,
  },
  "brazil::1970::joel": {
    searchQueries: ["Joel Camargo"],
    transfermarktId: "300938",
    birthYear: 1936,
  },
  "brazil::1970::leao": {
    skip: true,
  },
  "brazil::1970::pele": {
    searchQueries: ["Pele", "Edson Arantes"],
    transfermarktId: "17121",
    birthYear: 1940,
  },
  "brazil::1970::roberto": {
    searchQueries: ["Roberto Miranda"],
    transfermarktId: "229681",
    birthYear: 1944,
  },
};

function normalizeAliasToken(value: string): string {
  return value
    .replace(/^not applicable\s+/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeAliasTeam(team: string): string {
  return normalizeAliasToken(team);
}

export function transfermarktAliasKey(
  team: string,
  cup: number,
  catalogName: string,
): string {
  return `${normalizeAliasTeam(team)}::${cup}::${normalizeAliasToken(catalogName)}`;
}

export function lookupTransfermarktAlias(
  team: string,
  cup: number,
  catalogName: string,
): TransfermarktPlayerAlias | null {
  return ALIASES[transfermarktAliasKey(team, cup, catalogName)] ?? null;
}

export function buildTransfermarktSearchQueries(
  catalogName: string,
  team: string,
  cup: number,
): string[] {
  const alias = lookupTransfermarktAlias(team, cup, catalogName);
  const trimmed = catalogName.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const defaultQuery =
    parts.length === 1 && trimmed.length <= 4
      ? `${trimmed} ${team}`
      : trimmed;

  const queries: string[] = [];
  const seen = new Set<string>();

  for (const query of [...(alias?.searchQueries ?? []), defaultQuery]) {
    const normalized = query.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    queries.push(normalized);
  }

  if (parts.length > 1) {
    const bareName = trimmed;
    if (!seen.has(bareName)) {
      queries.push(bareName);
    }
  }

  return queries;
}

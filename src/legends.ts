/**
 * World Cup legends — curated Commons photos and golden-name styling for this
 * roster. Elite (85+ OVR) players may also keep Wikimedia/overlay headshots;
 * everyone else is stripped at catalog prepare time.
 */

import type { PlayerCard, SquadCatalog } from "./catalog.js";
import { cleanPlayerDisplayName } from "./playerNames.js";
import { commonsThumbUrl } from "./playerPhoto.js";
import { playerOverall } from "./playerRating.js";
import { ELITE_MIN_OVERALL } from "./playerTier.js";

export interface LegendEntry {
  /** UI label (hero ticker, accessibility). */
  displayName: string;
  /** Normalized names that identify this legend in catalog data. */
  names: readonly string[];
  /**
   * Optional team this entry is scoped to. Used to disambiguate legends who
   * share a normalized name (e.g. the Brazilian striker "Pepe" vs the
   * Portuguese defender "Pepe"). When set, the entry only matches catalog
   * players on that team.
   */
  team?: string;
  photoUrl: string;
  /**
   * Retired/historical all-time great. Drives the animated black-&-white "icon"
   * tier in the UI; unflagged (modern) legends use the gold treatment.
   */
  icon?: boolean;
}

/** Normalize a catalog player name (or team) for legend lookup. */
export function normalizeLegendName(name: string): string {
  return cleanPlayerDisplayName(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function legend(name: string, file: string, ...aliases: string[]): LegendEntry {
  const names = [name, ...aliases].map(normalizeLegendName);
  return {
    displayName: name,
    names,
    photoUrl: commonsThumbUrl(file),
  };
}

/** Retired/historical great \u2014 gets the animated black-&-white "icon" tier. */
function iconLegend(name: string, file: string, ...aliases: string[]): LegendEntry {
  return { ...legend(name, file, ...aliases), icon: true };
}

/** Team-scoped legend \u2014 only matches catalog players on `team`. */
function legendForTeam(
  name: string,
  team: string,
  file: string,
  ...aliases: string[]
): LegendEntry {
  return { ...legend(name, file, ...aliases), team };
}

/** Team-scoped retired/historical great (icon tier). */
function iconLegendForTeam(
  name: string,
  team: string,
  file: string,
  ...aliases: string[]
): LegendEntry {
  return { ...legendForTeam(name, team, file, ...aliases), icon: true };
}

/** Canonical legend roster — extend here, not via bulk Wikimedia import. */
export const LEGEND_ROSTER: readonly LegendEntry[] = [
  iconLegend("Pelé", "Pele_con_brasil_(cropped).jpg", "Pelé"),
  iconLegend("Garrincha", "Garrincha.jpg"),
  iconLegend("Ronaldo", "Ronaldo_2002_cropped.jpg"),
  iconLegend("Ronaldinho", "Ronaldinho-7-5-2006.jpg"),
  iconLegend("Maradona", "Maradona_1986_vs_italy.jpg", "Diego Maradona"),
  legend("Messi", "Lionel_Messi_20180626.jpg", "Lionel Messi"),
  legend("Cristiano Ronaldo", "Cristiano_Ronaldo_2018.jpg"),
  iconLegend("Figo", "Luis_Figo.jpg", "Luís Figo"),
  iconLegend("Zidane", "Zinedine zidane wcf 2006-edit.jpg", "Zinedine Zidane"),
  iconLegend("Beckenbauer", "Franz Beckenbauer 1972.jpg", "Franz Beckenbauer"),
  iconLegend("Zico", "Zico flamengo elgrafico.jpg"),
  iconLegend("Pirlo", "Andrea Pirlo 2017.jpg", "Andrea Pirlo"),
  iconLegend("Cruyff", "Johan Cruijff (1974).jpg", "Johan Cruyff"),
  // No free playing-era portrait of Maldini exists on Commons (match photos are
  // copyrighted); the available free shots are all post-career. Kept as-is.
  iconLegend("Maldini", "Paolo Maldini press conference in Tehran (cropped).jpg", "Paolo Maldini"),
  iconLegend("Xavi", "Xavi Hernandez (18090182763).jpg", "Xavi Hernández"),
  iconLegend("Rivaldo", "Rivaldo bunyodkor 2010.jpg"),
  iconLegend("Romário", "Salvaromariobrasil.jpg", "Romario"),
  iconLegend("Cafu", "Cafu 2007.jpg"),
  iconLegend("Kaká", "Kaká 2012.jpg", "Kaka"),
  legend("Neymar", "Neymar_2018.jpg"),
  iconLegend("Platini", "Platini panini calciatori.jpg", "Michel Platini"),
  iconLegend("Matthäus", "Lothar Matthäus 1995.jpg", "Lothar Matthäus"),
  iconLegend("Henry", "Thierry_Henry.jpg", "Thierry Henry"),
  iconLegend("Iniesta", "Spain - Chile - 10-09-2013 - Geneva - Andres Iniesta 4.jpg", "Andrés Iniesta"),
  iconLegend("Van Basten", "Marco van Basten 1989 crop.jpg", "Marco van Basten"),
  iconLegend("Eusébio", "Eusebio en 1973.jpg", "Eusebio"),
  legend("Modrić", "Luka Modric Interview 2021 (cropped).jpg", "Luka Modrić"),
  legend("Mbappé", "Kylian Mbappe 2017.jpg", "Kylian Mbappé"),
  iconLegend("Buffon", "Gianluigi Buffon (31784615942) (cropped).jpg", "Gianluigi Buffon"),
  legend("Kroos", "Toni Kroos (cropped).JPG", "Toni Kroos"),
  legend(
    "Ibrahimović",
    "Zlatan Ibrahimović 2.jpg",
    "Zlatan Ibrahimović",
    "Zlatan Ibrahimovic",
  ),
  legend("Marcelo", "2018 Russia vs. Brazil - Marcelo (cropped).jpg"),
  legend("Chiellini", "Giorgio Chiellini, 2015 (cropped).jpg", "Giorgio Chiellini"),
  legend("Cha Bum-kun", "Cha Bum Kun.jpg", "Bum-kun Cha"),
  iconLegend("Jairzinho", "Jairzinho (Jair Ventura Filho, 1970).jpg"),

  // Expanded roster (FIFA 100 / Britannica greats present in the catalog).
  iconLegend("Casillas", "Iker Casillas (2007) (cropped).JPG", "Iker Casillas"),
  iconLegend("Roberto Baggio", "Roberto Baggio - Italia '90.jpg"),
  iconLegend("Baresi", "Franco baresi panini card 1979.jpg", "Franco Baresi"),
  iconLegend("Cannavaro", "Fabio Cannavaro in world cup 2006.jpg", "Fabio Cannavaro"),
  iconLegend("Del Piero", "Del Piero Italia Mondiali 1998.jpg", "Alessandro Del Piero"),
  // Totti retired June 2017; Commons has no free playing-era portrait (Roma
  // match photos are copyrighted), so this just-post-career shot stays.
  iconLegend("Totti", "KL-2018 (4).jpg", "Francesco Totti"),
  iconLegend("Gerd Müller", "Gerd Müller c1973 (cropped).jpg", "Gerd Muller"),
  iconLegend("Rummenigge", "Karl Rummenigge 1986.jpg", "Karl-Heinz Rummenigge"),
  iconLegend("Kahn", "Oliver Kahn 06-2004.jpg", "Oliver Kahn"),
  iconLegend("Roberto Carlos", "Roberto Carlos in Moscow 3 (cropped).jpg"),
  iconLegend("Carlos Alberto", "Carlos alberto cosmos.jpg", "Carlos Alberto Torres"),
  iconLegend("Sócrates", "Socrates elgrafico 1983.jpg", "Socrates"),
  iconLegend("Rivellino", "Rivellino 1970.jpg", "Roberto Rivellino"),
  iconLegend("Tostão", "Tostão 1970.jpg", "Tostao"),
  iconLegend("Gullit", "Ruud Gullit 1988.jpg", "Ruud Gullit"),
  iconLegend("Rijkaard", "Frank Rijkaard 1988 crop.jpg", "Frank Rijkaard"),
  iconLegend("Bergkamp", "Dennis Bergkamp Aug2003.JPG", "Dennis Bergkamp"),
  // No free playing-era portrait of Stoichkov on Commons (only a wide 1994 WC
  // celebration crops badly); this post-career portrait stays for now.
  iconLegend("Stoichkov", "Stoichkov in 2016.jpg", "Hristo Stoichkov"),
  iconLegend("Batistuta", "Omar Batistuta (2).jpg", "Gabriel Batistuta"),
  iconLegend("Kempes", "Kempes Valencia CF.jpg", "Mario Kempes"),
  iconLegend("Passarella", "Daniel passarella en 1985.jpg", "Daniel Passarella"),
  iconLegend("Zoff", "Dino Zoff - 1972 - Juventus FC (cropped).jpg", "Dino Zoff"),

  // Two distinct legends share the normalized name "pepe" — scope by team.
  iconLegendForTeam("Pepe", "Brazil", "Pepe 22.jpg"),
  iconLegendForTeam("Pepe", "Portugal", "Pepe 2018.jpg"),
];

/** All normalized legend names (used for golden-name styling, team-agnostic). */
const LEGEND_NAME_SET = new Set<string>();
/** Generic (team-agnostic) entries, keyed by normalized name. */
const LEGEND_BY_NORM = new Map<string, LegendEntry>();
/** Team-scoped entries, keyed by `${normName}|${normTeam}`. */
const LEGEND_BY_NORM_TEAM = new Map<string, LegendEntry>();

for (const entry of LEGEND_ROSTER) {
  for (const n of entry.names) {
    LEGEND_NAME_SET.add(n);
    if (entry.team) {
      LEGEND_BY_NORM_TEAM.set(`${n}|${normalizeLegendName(entry.team)}`, entry);
    } else {
      LEGEND_BY_NORM.set(n, entry);
    }
  }
}

/** Display names for hero ticker / marketing copy (deduped). */
export const LEGEND_DISPLAY_NAMES: readonly string[] = [
  ...new Set(LEGEND_ROSTER.map((e) => e.displayName)),
];

const LEGEND_DISPLAY_TIER = new Map<string, "icon" | "legend">(
  LEGEND_ROSTER.map((entry) => [
    entry.displayName,
    entry.icon ? "icon" : "legend",
  ] as const),
);

/** Hero ticker tier — retired greats are `icon` (B&W), modern legends are `legend`. */
export function legendDisplayTier(displayName: string): "icon" | "legend" {
  return LEGEND_DISPLAY_TIER.get(displayName) ?? "legend";
}

/**
 * Resolve the legend entry for a catalog player. Pass `team` to disambiguate
 * legends that share a normalized name (e.g. the two "Pepe"s); a team-scoped
 * match wins over a generic one.
 */
export function legendEntryForName(
  name: string,
  team?: string,
): LegendEntry | undefined {
  const n = normalizeLegendName(name);
  if (team !== undefined) {
    const scoped = LEGEND_BY_NORM_TEAM.get(`${n}|${normalizeLegendName(team)}`);
    if (scoped) return scoped;
  }
  return LEGEND_BY_NORM.get(n);
}

export function isLegendPlayer(name: string): boolean {
  return LEGEND_NAME_SET.has(normalizeLegendName(name));
}

function stripPhoto(player: PlayerCard): PlayerCard {
  if (player.photoUrl === undefined && player.photoSource === undefined) {
    return player;
  }
  const { photoUrl: _u, photoSource: _s, ...rest } = player;
  return rest;
}

/** Keep curated legend photos and any headshots for elite (85+) players. */
export function applyLegendPhotosToCatalog(
  catalog: SquadCatalog,
): SquadCatalog {
  const players: Record<string, PlayerCard> = {};

  for (const [id, player] of Object.entries(catalog.players)) {
    const entry = legendEntryForName(player.name, player.team);
    if (entry) {
      players[id] = {
        ...player,
        photoUrl: entry.photoUrl,
        photoSource: "curated",
      };
      continue;
    }

    if (playerOverall(player) >= ELITE_MIN_OVERALL && player.photoUrl) {
      players[id] = player;
      continue;
    }

    players[id] = stripPhoto(player);
  }

  return { ...catalog, players };
}

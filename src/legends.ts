/**
 * World Cup legends — photos and golden-name styling apply only to this roster.
 *
 * Matched by normalized player name (same rules as squad overlay). Avoid broad
 * substrings (e.g. "messi" would hit Musimessi).
 */

import type { PlayerCard, SquadCatalog } from "./catalog.js";
import { cleanPlayerDisplayName } from "./playerNames.js";
import { commonsThumbUrl } from "./playerPhoto.js";

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

/** Team-scoped legend \u2014 only matches catalog players on `team`. */
function legendForTeam(
  name: string,
  team: string,
  file: string,
  ...aliases: string[]
): LegendEntry {
  return { ...legend(name, file, ...aliases), team };
}

/** Canonical legend roster — extend here, not via bulk Wikimedia import. */
export const LEGEND_ROSTER: readonly LegendEntry[] = [
  legend("Pelé", "Pele_con_brasil_(cropped).jpg", "Pelé"),
  legend("Garrincha", "Garrincha.jpg"),
  legend("Ronaldo", "Ronaldo_2002_cropped.jpg"),
  legend("Ronaldinho", "Ronaldinho-7-5-2006.jpg"),
  legend("Maradona", "Maradona_1986_vs_italy.jpg", "Diego Maradona"),
  legend("Messi", "Lionel_Messi_20180626.jpg", "Lionel Messi"),
  legend("Cristiano Ronaldo", "Cristiano_Ronaldo_2018.jpg"),
  legend("Figo", "Luis_Figo.jpg", "Luís Figo"),
  legend("Zidane", "Zinedine zidane wcf 2006-edit.jpg", "Zinedine Zidane"),
  legend("Beckenbauer", "Franz Beckenbauer 1972.jpg", "Franz Beckenbauer"),
  legend("Zico", "Zico flamengo elgrafico.jpg"),
  legend("Pirlo", "Andrea Pirlo 2017.jpg", "Andrea Pirlo"),
  legend("Cruyff", "Johan Cruijff (1974).jpg", "Johan Cruyff"),
  // No free playing-era portrait of Maldini exists on Commons (match photos are
  // copyrighted); the available free shots are all post-career. Kept as-is.
  legend("Maldini", "Paolo Maldini press conference in Tehran (cropped).jpg", "Paolo Maldini"),
  legend("Xavi", "Xavi Hernandez (18090182763).jpg", "Xavi Hernández"),
  legend("Rivaldo", "Rivaldo bunyodkor 2010.jpg"),
  legend("Romário", "Salvaromariobrasil.jpg", "Romario"),
  legend("Cafu", "Cafu 2007.jpg"),
  legend("Kaká", "Kaká 2012.jpg", "Kaka"),
  legend("Neymar", "Neymar_2018.jpg"),
  legend("Platini", "Platini panini calciatori.jpg", "Michel Platini"),
  legend("Matthäus", "Lothar Matthäus 1995.jpg", "Lothar Matthäus"),
  legend("Henry", "Thierry_Henry.jpg", "Thierry Henry"),
  legend("Iniesta", "Spain - Chile - 10-09-2013 - Geneva - Andres Iniesta 4.jpg", "Andrés Iniesta"),
  legend("Van Basten", "Marco van Basten 1989 crop.jpg", "Marco van Basten"),
  legend("Eusébio", "Eusebio en 1973.jpg", "Eusebio"),
  legend("Modrić", "Luka Modric Interview 2021 (cropped).jpg", "Luka Modrić"),
  legend("Mbappé", "Kylian Mbappe 2017.jpg", "Kylian Mbappé"),
  legend("Buffon", "Gianluigi Buffon (31784615942) (cropped).jpg", "Gianluigi Buffon"),
  legend("Jairzinho", "Jairzinho (Jair Ventura Filho, 1970).jpg"),

  // Expanded roster (FIFA 100 / Britannica greats present in the catalog).
  legend("Casillas", "Iker Casillas (2007) (cropped).JPG", "Iker Casillas"),
  legend("Roberto Baggio", "Roberto Baggio - Italia '90.jpg"),
  legend("Baresi", "Franco baresi panini card 1979.jpg", "Franco Baresi"),
  legend("Cannavaro", "Fabio Cannavaro in world cup 2006.jpg", "Fabio Cannavaro"),
  legend("Del Piero", "Del Piero Italia Mondiali 1998.jpg", "Alessandro Del Piero"),
  // Totti retired June 2017; Commons has no free playing-era portrait (Roma
  // match photos are copyrighted), so this just-post-career shot stays.
  legend("Totti", "KL-2018 (4).jpg", "Francesco Totti"),
  legend("Gerd Müller", "Gerd Müller c1973 (cropped).jpg", "Gerd Muller"),
  legend("Rummenigge", "Karl Rummenigge 1986.jpg", "Karl-Heinz Rummenigge"),
  legend("Kahn", "Oliver Kahn 06-2004.jpg", "Oliver Kahn"),
  legend("Roberto Carlos", "Roberto Carlos in Moscow 3 (cropped).jpg"),
  legend("Carlos Alberto", "Carlos alberto cosmos.jpg", "Carlos Alberto Torres"),
  legend("Sócrates", "Socrates elgrafico 1983.jpg", "Socrates"),
  legend("Rivellino", "Rivellino 1970.jpg", "Roberto Rivellino"),
  legend("Tostão", "Tostão 1970.jpg", "Tostao"),
  legend("Gullit", "Ruud Gullit 1988.jpg", "Ruud Gullit"),
  legend("Rijkaard", "Frank Rijkaard 1988 crop.jpg", "Frank Rijkaard"),
  legend("Bergkamp", "Dennis Bergkamp Aug2003.JPG", "Dennis Bergkamp"),
  // No free playing-era portrait of Stoichkov on Commons (only a wide 1994 WC
  // celebration crops badly); this post-career portrait stays for now.
  legend("Stoichkov", "Stoichkov in 2016.jpg", "Hristo Stoichkov"),
  legend("Batistuta", "Omar Batistuta (2).jpg", "Gabriel Batistuta"),
  legend("Kempes", "Kempes Valencia CF.jpg", "Mario Kempes"),
  legend("Passarella", "Daniel passarella en 1985.jpg", "Daniel Passarella"),
  legend("Zoff", "Dino Zoff - 1972 - Juventus FC (cropped).jpg", "Dino Zoff"),

  // Two distinct legends share the normalized name "pepe" — scope by team.
  legendForTeam("Pepe", "Brazil", "Pepe 22.jpg"),
  legendForTeam("Pepe", "Portugal", "Pepe 2018.jpg"),
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

/** Keep photos only for legends; strip all other headshots. */
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
    } else {
      players[id] = stripPhoto(player);
    }
  }

  return { ...catalog, players };
}

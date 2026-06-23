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
  photoUrl: string;
}

/** Normalize a catalog player name for legend lookup. */
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
  legend("Zidane", "Zinedine Zidane by Tasnim 03.jpg", "Zinedine Zidane"),
  legend("Beckenbauer", "Beckenbauer Close.jpg", "Franz Beckenbauer"),
  legend("Zico", "Zico 2012.jpg"),
  legend("Pirlo", "Andrea Pirlo 2017.jpg", "Andrea Pirlo"),
  legend("Cruyff", "Johan Cruijff (1974).jpg", "Johan Cruyff"),
  legend("Maldini", "Paolo Maldini press conference in Tehran (cropped).jpg", "Paolo Maldini"),
  legend("Xavi", "Xavi Hernandez (18090182763).jpg", "Xavi Hernández"),
  legend("Rivaldo", "Rivaldo bunyodkor 2010.jpg"),
  legend("Romário", "Salvaromariobrasil.jpg", "Romario"),
  legend("Cafu", "Cafu no Olinda Fashion Week de 2012, 01.jpg"),
  legend("Kaká", "Kaká 2012.jpg", "Kaka"),
  legend("Neymar", "Neymar_2018.jpg"),
  legend("Platini", "Michel_Platini_2010.jpg", "Michel Platini"),
  legend("Matthäus", "Lothar Matthaeus 2002.jpg", "Lothar Matthäus"),
  legend("Henry", "Thierry_Henry.jpg", "Thierry Henry"),
  legend("Iniesta", "Spain - Chile - 10-09-2013 - Geneva - Andres Iniesta 4.jpg", "Andrés Iniesta"),
  legend("Van Basten", "Marco van Basten (ca 2006).jpg", "Marco van Basten"),
  legend("Eusébio", "Eusebio en 1973.jpg", "Eusebio"),
  legend("Modrić", "Luka Modric Interview 2021 (cropped).jpg", "Luka Modrić"),
  legend("Mbappé", "Kylian Mbappe 2017.jpg", "Kylian Mbappé"),
  legend("Buffon", "Gianluigi Buffon (31784615942) (cropped).jpg", "Gianluigi Buffon"),
  legend("Jairzinho", "Jairzinho (Jair Ventura Filho, 1970).jpg"),
];

const LEGEND_BY_NORM = new Map<string, LegendEntry>();
for (const entry of LEGEND_ROSTER) {
  for (const n of entry.names) {
    LEGEND_BY_NORM.set(n, entry);
  }
}

/** Display names for hero ticker / marketing copy. */
export const LEGEND_DISPLAY_NAMES: readonly string[] = LEGEND_ROSTER.map(
  (e) => e.displayName,
);

export function legendEntryForName(name: string): LegendEntry | undefined {
  return LEGEND_BY_NORM.get(normalizeLegendName(name));
}

export function isLegendPlayer(name: string): boolean {
  return LEGEND_BY_NORM.has(normalizeLegendName(name));
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
    const entry = legendEntryForName(player.name);
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

/**
 * Weekly Boss — thematic all-star squads (M6).
 *
 * Unlike the old model (a random historical national team), each Boss is a
 * curated fantasy XI drawn from the catalog by legend/name rules. The active
 * Boss rotates deterministically by ISO week (`bossSeed` → `bossForWeek`).
 */

import type { SquadCatalog, PlayerCard } from "./catalog.js";
import { formationAnchors } from "./formations.js";
import { legendEntryForName, normalizeLegendName } from "./legends.js";
import { canPlayInSlot } from "./playerPositions.js";
import { playerOverall } from "./playerRating.js";
import { bossSeed } from "./period.js";
import { pick, rngFromSeed } from "./rng.js";
import type { Tactic } from "./constants.js";
import {
  initBuildState,
  validateBuildState,
  type BuildState,
  type BuildSlot,
} from "./roll.js";
import type { Side } from "./types.js";

export type BossDifficulty = "hard" | "veryHard";

/** How to find a catalog player for one Boss slot. */
export interface BossPlayerQuery {
  /** Legend display name and/or catalog name fragments (most specific first). */
  names: readonly string[];
  team?: string;
  cupMin?: number;
  cupMax?: number;
}

/** One XI slot: primary candidates plus explicit fallbacks. */
export interface BossSlotRule {
  slotIndex: number;
  candidates: readonly BossPlayerQuery[];
  fallbacks?: readonly BossPlayerQuery[];
}

export interface BossDefinition {
  id: string;
  name: string;
  subtitle: string;
  difficulty: BossDifficulty;
  formationId: string;
  tactic: Tactic;
  /** Short list for UI/marketing (static, not resolved from catalog). */
  featuredPlayers: readonly string[];
  slots: readonly BossSlotRule[];
}

export interface ResolvedBossWeek {
  weekKey: string;
  definition: BossDefinition;
  buildState: BuildState;
  tactic: Tactic;
  /** Resolved XI display names in formation order. */
  lineupNames: readonly string[];
}

const q = (
  names: readonly string[],
  team?: string,
  cupMin?: number,
  cupMax?: number,
): BossPlayerQuery => ({
  names,
  ...(team !== undefined ? { team } : {}),
  ...(cupMin !== undefined ? { cupMin } : {}),
  ...(cupMax !== undefined ? { cupMax } : {}),
});

function slot(
  slotIndex: number,
  candidates: readonly BossPlayerQuery[],
  fallbacks?: readonly BossPlayerQuery[],
): BossSlotRule {
  return { slotIndex, candidates, ...(fallbacks ? { fallbacks } : {}) };
}

function namesMatch(playerName: string, candidate: string, playerTeam?: string): boolean {
  const legendTarget = legendEntryForName(candidate);
  const playerLegend = legendEntryForName(playerName, playerTeam);

  if (legendTarget && playerLegend && legendTarget.displayName === playerLegend.displayName) {
    return true;
  }

  const np = normalizeLegendName(playerName);
  const nc = normalizeLegendName(candidate);
  if (np === nc) return true;

  if (legendTarget) {
    for (const alias of legendTarget.names) {
      if (np === alias) return true;
    }
  }

  if (nc.length >= 5 && (np.endsWith(nc) || np.includes(nc))) return true;
  return false;
}

const TEAM_ALIASES: Readonly<Record<string, readonly string[]>> = {
  Germany: ["Germany", "West Germany"],
  "West Germany": ["Germany", "West Germany"],
};

function teamMatches(playerTeam: string, queryTeam: string): boolean {
  if (playerTeam === queryTeam) return true;
  const aliases = TEAM_ALIASES[queryTeam];
  return aliases?.includes(playerTeam) ?? false;
}

function playerMatchesQuery(player: PlayerCard, query: BossPlayerQuery): boolean {
  if (query.team !== undefined && !teamMatches(player.team, query.team)) return false;
  if (query.cupMin !== undefined && player.cup < query.cupMin) return false;
  if (query.cupMax !== undefined && player.cup > query.cupMax) return false;

  for (const candidate of query.names) {
    if (namesMatch(player.name, candidate, player.team)) return true;
  }
  return false;
}

/** All catalog players matching a query, best overall first. */
export function findBossPlayers(
  catalog: SquadCatalog,
  query: BossPlayerQuery,
  excludeIds: ReadonlySet<string> = new Set(),
): PlayerCard[] {
  const hits: PlayerCard[] = [];
  for (const player of Object.values(catalog.players)) {
    if (excludeIds.has(player.id)) continue;
    if (playerMatchesQuery(player, query)) hits.push(player);
  }
  hits.sort((a, b) => {
    const d = playerOverall(b) - playerOverall(a);
    if (d !== 0) return d;
    return b.cup - a.cup;
  });
  return hits;
}

function resolveSlotPlayer(
  catalog: SquadCatalog,
  rule: BossSlotRule,
  position: string,
  usedIds: Set<string>,
): PlayerCard {
  const queries = [...rule.candidates, ...(rule.fallbacks ?? [])];
  for (const query of queries) {
    for (const player of findBossPlayers(catalog, query, usedIds)) {
      if (canPlayInSlot(player, position)) return player;
    }
  }
  throw new Error(
    `Boss slot ${rule.slotIndex} (${position}): no catalog player matched ${JSON.stringify(rule.candidates)}`,
  );
}

/** Deterministic Boss pick for an ISO week key. */
export function bossForWeek(weekKey: string): BossDefinition {
  if (BOSS_DEFINITIONS.length === 0) {
    throw new Error("bossForWeek: empty BOSS_DEFINITIONS");
  }
  const rng = rngFromSeed(`${bossSeed(weekKey)}:pick`);
  return pick(rng, BOSS_DEFINITIONS);
}

/** Build a fixed Boss XI as a completed `BuildState`. */
export function resolveBossBuildState(
  catalog: SquadCatalog,
  definition: BossDefinition,
  weekKey: string,
  side: Side = "away",
): BuildState {
  const seed = bossSeed(weekKey);
  const base = initBuildState(
    catalog,
    seed,
    side,
    undefined,
    definition.formationId,
  );
  const usedIds = new Set<string>();
  const slots: BuildSlot[] = base.slots.map((s, slotIndex) => {
    const rule = definition.slots.find((r) => r.slotIndex === slotIndex);
    if (!rule) {
      throw new Error(
        `Boss ${definition.id}: missing slot rule for index ${slotIndex}`,
      );
    }
    const player = resolveSlotPlayer(catalog, rule, s.position, usedIds);
    usedIds.add(player.id);
    return { ...s, selectedPlayerId: player.id };
  });

  const state: BuildState = {
    ...base,
    slots,
    turnIndex: slots.length,
  };

  const validation = validateBuildState(catalog, state);
  if (!validation.ok) {
    throw new Error(
      `Boss ${definition.id} invalid XI: ${validation.errors.map((e) => e.message).join("; ")}`,
    );
  }
  return state;
}

/** Full weekly Boss resolution — definition + fixed away XI. */
export function resolveBossForWeek(
  catalog: SquadCatalog,
  weekKey: string,
): ResolvedBossWeek {
  const definition = bossForWeek(weekKey);
  const buildState = resolveBossBuildState(catalog, definition, weekKey, "away");
  const lineupNames = buildState.slots.map((s) => {
    const id = s.selectedPlayerId;
    if (!id) throw new Error("incomplete boss slot");
    return catalog.players[id]!.name;
  });
  return {
    weekKey,
    definition,
    buildState,
    tactic: definition.tactic,
    lineupNames,
  };
}

export const BOSS_DEFINITIONS: readonly BossDefinition[] = [
  {
    id: "best-of-90s",
    name: "The Best of 90s",
    subtitle: "Zidane, Ronaldo, Maldini and the decade that never ended.",
    difficulty: "veryHard",
    formationId: "433-attack",
    tactic: "offensive",
    featuredPlayers: ["Ronaldo", "Zidane", "Maldini", "Romário", "Cafu"],
    slots: [
      slot(0, [q(["Peter Schmeichel", "Schmeichel"], "Denmark", 1990, 1998)], [q(["Manuel Neuer", "Neuer"], "Germany"), q(["Gianluigi Buffon", "Buffon"], "Italy")]),
      slot(1, [q(["Cafu"], "Brazil", 1994, 2002)]),
      slot(2, [q(["Franco Baresi", "Baresi"], "Italy", 1982, 1994)]),
      slot(3, [q(["Fabio Cannavaro", "Cannavaro"], "Italy", 1998, 2006)]),
      slot(4, [q(["Paolo Maldini", "Maldini"], "Italy", 1990, 2006)]),
      slot(5, [q(["Lothar Matthäus", "Matthäus"], "Germany", 1986, 1994)]),
      slot(6, [q(["Zinedine Zidane", "Zidane"], "France", 1994, 2006)]),
      slot(7, [q(["Roberto Baggio", "Baggio"], "Italy", 1990, 1998)]),
      slot(8, [q(["Ronaldo"], "Brazil", 1994, 2002)]),
      slot(9, [q(["Romário", "Romario"], "Brazil", 1990, 1998)]),
      slot(10, [q(["Hristo Stoichkov", "Stoichkov"], "Bulgaria", 1990, 1998)]),
    ],
  },
  {
    id: "best-of-brazil",
    name: "The Best of Brazil",
    subtitle: "Pelé, Ronaldo, Ronaldinho — the impossible yellow wall.",
    difficulty: "veryHard",
    formationId: "433-balanced",
    tactic: "balanced",
    featuredPlayers: ["Pelé", "Ronaldo", "Ronaldinho", "Rivaldo", "Cafu"],
    slots: [
      slot(0, [q(["Dida"], "Brazil", 1998, 2006)], [q(["Cláudio Taffarel", "Taffarel"], "Brazil"), q(["Marcos"], "Brazil")]),
      slot(1, [q(["Cafu"], "Brazil", 1994, 2006)]),
      slot(2, [q(["Roberto Carlos"], "Brazil", 1994, 2006)]),
      slot(3, [q(["Marcelo"], "Brazil", 2014, 2018)]),
      slot(4, [q(["Lúcio", "Lucio"], "Brazil", 2002, 2010)]),
      slot(5, [q(["Ronaldinho"], "Brazil", 2002, 2006)]),
      slot(6, [q(["Zico"], "Brazil", 1978, 1986)]),
      slot(7, [q(["Sócrates", "Socrates"], "Brazil", 1978, 1986)]),
      slot(8, [q(["Jairzinho"], "Brazil", 1970, 1974)]),
      slot(9, [q(["Ronaldo"], "Brazil", 1994, 2002)]),
      slot(10, [q(["Neymar"], "Brazil", 2014, 2022)], [q(["Rivaldo"], "Brazil")]),
    ],
  },
  {
    id: "total-football-ghosts",
    name: "Total Football Ghosts",
    subtitle: "Cruyff's heirs — press, pass, and punish.",
    difficulty: "hard",
    formationId: "433-false9",
    tactic: "offensive",
    featuredPlayers: ["Cruyff", "Gullit", "Van Basten", "Bergkamp"],
    slots: [
      slot(0, [q(["Edwin van der Sar", "Van der Sar"], "Netherlands", 1994, 2010)]),
      slot(1, [q(["André Ooijer", "Ooijer"], "Netherlands")], [q(["Dirk Kuyt", "Kuyt"], "Netherlands")]),
      slot(2, [q(["Frank de Boer", "De Boer"], "Netherlands", 1994, 2000)]),
      slot(3, [q(["Giovanni van Bronckhorst", "Van Bronckhorst"], "Netherlands", 1998, 2010)]),
      slot(4, [q(["Ronald Koeman", "Koeman"], "Netherlands", 1988, 1994)]),
      slot(5, [q(["Frank Rijkaard", "Rijkaard"], "Netherlands", 1988, 1994)]),
      slot(6, [q(["Johan Cruyff", "Cruyff"], "Netherlands", 1974)]),
      slot(7, [q(["Ruud Gullit", "Gullit"], "Netherlands", 1988, 1994)]),
      slot(8, [q(["Marco van Basten", "Van Basten"], "Netherlands", 1988, 1992)]),
      slot(9, [q(["Dennis Bergkamp", "Bergkamp"], "Netherlands", 1994, 2002)]),
      slot(10, [q(["Johnny Rep", "Rep"], "Netherlands")], [q(["Arjen Robben", "Robben"], "Netherlands")]),
    ],
  },
  {
    id: "catenaccio-immortale",
    name: "Catenaccio Immortale",
    subtitle: "Baresi, Maldini, Cannavaro — score if you dare.",
    difficulty: "hard",
    formationId: "532-defensive",
    tactic: "defensive",
    featuredPlayers: ["Maldini", "Baresi", "Cannavaro", "Buffon", "Pirlo"],
    slots: [
      slot(0, [q(["Gianluigi Buffon", "Buffon"], "Italy", 1998, 2014)], [q(["Dino Zoff", "Zoff"], "Italy")]),
      slot(1, [q(["Franco Baresi", "Baresi"], "Italy", 1982, 1994)]),
      slot(2, [q(["Alessandro Nesta", "Nesta"], "Italy", 1998, 2006)]),
      slot(3, [q(["Fabio Cannavaro", "Cannavaro"], "Italy", 1998, 2006)]),
      slot(4, [q(["Gianluca Zambrotta", "Zambrotta"], "Italy", 2002, 2006)]),
      slot(5, [q(["Paolo Maldini", "Maldini"], "Italy", 1990, 2006)]),
      slot(6, [q(["Andrea Pirlo", "Pirlo"], "Italy", 2002, 2014)]),
      slot(7, [q(["Daniele De Rossi", "De Rossi"], "Italy", 2006, 2014)]),
      slot(8, [q(["Gennaro Gattuso", "Gattuso"], "Italy", 2002, 2010)]),
      slot(9, [q(["Francesco Totti", "Totti"], "Italy", 1998, 2006)]),
      slot(10, [q(["Roberto Baggio", "Baggio"], "Italy", 1990, 1998)]),
    ],
  },
  {
    id: "la-albiceleste-mythos",
    name: "La Albiceleste Mythos",
    subtitle: "Maradona and Messi — two gods, one shirt.",
    difficulty: "veryHard",
    formationId: "433-balanced",
    tactic: "offensive",
    featuredPlayers: ["Messi", "Maradona", "Batistuta", "Kempes"],
    slots: [
      slot(0, [q(["Emiliano Martínez", "Martinez"], "Argentina", 2022)]),
      slot(1, [q(["Roberto Ayala", "Ayala"], "Argentina", 1998, 2006)]),
      slot(2, [q(["Daniel Passarella", "Passarella"], "Argentina", 1978, 1986)]),
      slot(3, [q(["Javier Zanetti", "Zanetti"], "Argentina", 1998, 2006)]),
      slot(4, [q(["Nicolás Otamendi", "Otamendi"], "Argentina", 2014, 2022)]),
      slot(5, [q(["Fernando Redondo", "Redondo"], "Argentina", 1994, 1998)]),
      slot(6, [q(["Enzo Fernández", "Fernandez"], "Argentina", 2022)]),
      slot(7, [q(["Diego Maradona", "Maradona"], "Argentina", 1982, 1994)]),
      slot(8, [q(["Ángel Di María", "Di Maria", "Di María"], "Argentina", 2010, 2022)]),
      slot(9, [q(["Gabriel Batistuta", "Batistuta"], "Argentina", 1994, 2002)]),
      slot(10, [q(["Lionel Messi", "Messi"], "Argentina", 2006, 2022)]),
    ],
  },
  {
    id: "galacticos-without-borders",
    name: "Galácticos Without Borders",
    subtitle: "Attack is the only language they speak.",
    difficulty: "hard",
    formationId: "424-offensive",
    tactic: "offensive",
    featuredPlayers: ["Cristiano Ronaldo", "Henry", "Mbappé", "Ronaldo"],
    slots: [
      slot(0, [q(["Iker Casillas", "Casillas"], "Spain", 2002, 2014)]),
      slot(1, [q(["Cafu"], "Brazil", 1994, 2002)]),
      slot(2, [q(["Marcelo"], "Brazil", 2014, 2018)]),
      slot(3, [q(["Alessandro Nesta", "Nesta"], "Italy", 1998, 2006)]),
      slot(4, [q(["Paolo Maldini", "Maldini"], "Italy", 1990, 2006)]),
      slot(5, [q(["Luka Modrić", "Modric", "Modrić"], "Croatia", 2010, 2022)]),
      slot(6, [q(["Zinedine Zidane", "Zidane"], "France", 1998, 2006)]),
      slot(7, [q(["Cristiano Ronaldo"], "Portugal", 2006, 2022)]),
      slot(8, [q(["Ronaldo"], "Brazil", 1994, 2002)]),
      slot(9, [q(["Romário", "Romario"], "Brazil", 1990, 1998)], [q(["Gabriel Batistuta", "Batistuta"], "Argentina")]),
      slot(10, [q(["Kylian Mbappé", "Mbappe", "Mbappé"], "France", 2018, 2022)]),
    ],
  },
  {
    id: "wall-of-europe",
    name: "Wall of Europe",
    subtitle: "Neuer, Buffon, Casillas — clean sheets are the trophy.",
    difficulty: "hard",
    formationId: "451-defensive",
    tactic: "defensive",
    featuredPlayers: ["Neuer", "Buffon", "Cannavaro", "Maldini", "Pirlo"],
    slots: [
      slot(0, [q(["Manuel Neuer", "Neuer"], "Germany", 2010, 2018)], [q(["Gianluigi Buffon", "Buffon"], "Italy"), q(["Iker Casillas", "Casillas"], "Spain")]),
      slot(1, [q(["Philipp Lahm", "Lahm"], "Germany", 2006, 2014)]),
      slot(2, [q(["Alessandro Nesta", "Nesta"], "Italy", 1998, 2006)]),
      slot(3, [q(["Fabio Cannavaro", "Cannavaro"], "Italy", 1998, 2006)]),
      slot(4, [q(["Paolo Maldini", "Maldini"], "Italy", 1990, 2006)]),
      slot(5, [q(["Thierry Henry", "Henry"], "France", 1998, 2006)]),
      slot(6, [q(["Luka Modrić", "Modric", "Modrić"], "Croatia", 2010, 2022)]),
      slot(7, [q(["Andrea Pirlo", "Pirlo"], "Italy", 2002, 2014)]),
      slot(8, [q(["Xavi"], "Spain", 2006, 2014)]),
      slot(9, [q(["Hristo Stoichkov", "Stoichkov"], "Bulgaria", 1990, 1998)]),
      slot(10, [q(["Cristiano Ronaldo"], "Portugal", 2006, 2022)]),
    ],
  },
  {
    id: "kings-of-the-final",
    name: "Kings of the Final",
    subtitle: "Men who only showed up when the trophy was on the line.",
    difficulty: "hard",
    formationId: "442-balanced",
    tactic: "balanced",
    featuredPlayers: ["Zidane", "Xavi", "Gerd Müller", "Pelé"],
    slots: [
      slot(0, [q(["Gordon Banks", "Banks"], "England", 1966)], [q(["Dino Zoff", "Zoff"], "Italy")]),
      slot(1, [q(["Cafu"], "Brazil", 1994, 2002)]),
      slot(2, [q(["Franco Baresi", "Baresi"], "Italy", 1982, 1994)]),
      slot(3, [q(["Franz Beckenbauer", "Beckenbauer"], "West Germany", 1966, 1974)]),
      slot(4, [q(["Paolo Maldini", "Maldini"], "Italy", 1990, 2006)]),
      slot(5, [q(["Pelé"], "Brazil", 1958, 1970)]),
      slot(6, [q(["Zinedine Zidane", "Zidane"], "France", 1998, 2006)]),
      slot(7, [q(["Xavi"], "Spain", 2006, 2014)]),
      slot(8, [q(["Andrea Pirlo", "Pirlo"], "Italy", 2002, 2014)]),
      slot(9, [q(["Gerd Müller", "Muller"], "West Germany", 1970, 1974)]),
      slot(10, [q(["Mario Kempes", "Kempes"], "Argentina", 1978)]),
    ],
  },
  {
    id: "left-footed-curse",
    name: "The Left-Footed Curse",
    subtitle: "Messi, Maradona, Rivaldo — beauty bends left.",
    difficulty: "hard",
    formationId: "4231-balanced",
    tactic: "balanced",
    featuredPlayers: ["Messi", "Maradona", "Rivaldo", "Stoichkov", "Roberto Carlos"],
    slots: [
      slot(0, [q(["Lev Yashin", "Yashin"], "Soviet Union", 1958, 1966)], [q(["Peter Schmeichel", "Schmeichel"], "Denmark")]),
      slot(1, [q(["Cafu"], "Brazil", 1994, 2002)]),
      slot(2, [q(["Roberto Carlos"], "Brazil", 1994, 2006)]),
      slot(3, [q(["Daniel Passarella", "Passarella"], "Argentina", 1978, 1986)]),
      slot(4, [q(["Nicolás Otamendi", "Otamendi"], "Argentina", 2014, 2022)]),
      slot(5, [q(["Andrea Pirlo", "Pirlo"], "Italy", 2002, 2014)]),
      slot(6, [q(["Luka Modrić", "Modric", "Modrić"], "Croatia", 2010, 2022)]),
      slot(7, [q(["Diego Maradona", "Maradona"], "Argentina", 1982, 1994)]),
      slot(8, [q(["Lionel Messi", "Messi"], "Argentina", 2006, 2022)]),
      slot(9, [q(["Hristo Stoichkov", "Stoichkov"], "Bulgaria", 1990, 1998)]),
      slot(10, [q(["Gabriel Batistuta", "Batistuta"], "Argentina", 1994, 2002)]),
    ],
  },
  {
    id: "chaos-xi",
    name: "Chaos XI",
    subtitle: "Five up front, three at the back — pure madness.",
    difficulty: "veryHard",
    formationId: "343-offensive",
    tactic: "offensive",
    featuredPlayers: ["Ronaldo", "Henry", "Mbappé", "Ronaldinho", "Batistuta"],
    slots: [
      slot(0, [q(["Manuel Neuer", "Neuer"], "Germany", 2010, 2018)]),
      slot(1, [q(["Marcelo"], "Brazil", 2014, 2018)]),
      slot(2, [q(["Alessandro Nesta", "Nesta"], "Italy", 1998, 2006)]),
      slot(3, [q(["Fabio Cannavaro", "Cannavaro"], "Italy", 1998, 2006)]),
      slot(4, [q(["Thierry Henry", "Henry"], "France", 1998, 2006)]),
      slot(5, [q(["Ronaldinho"], "Brazil", 2002, 2006)]),
      slot(6, [q(["Zinedine Zidane", "Zidane"], "France", 1998, 2006)]),
      slot(7, [q(["Hristo Stoichkov", "Stoichkov"], "Bulgaria", 1990, 1998)]),
      slot(8, [q(["Ronaldo"], "Brazil", 1994, 2002)]),
      slot(9, [q(["Gabriel Batistuta", "Batistuta"], "Argentina", 1994, 2002)]),
      slot(10, [q(["Kylian Mbappé", "Mbappe", "Mbappé"], "France", 2018, 2022)]),
    ],
  },
] as const;

/** Slot count must match each Boss formation (sanity check at module load). */
for (const boss of BOSS_DEFINITIONS) {
  const expected = formationAnchors(boss.formationId).length;
  if (boss.slots.length !== expected) {
    throw new Error(
      `Boss ${boss.id}: expected ${expected} slot rules, got ${boss.slots.length}`,
    );
  }
}

/**
 * Sample scenarios for the M2 roll + simulate demo.
 *
 * The engine package has no player/squad/team data yet (that arrives with the
 * Build screen in M3), so these are a handful of hardcoded iconic World Cup
 * sides with neutral attack/defense/overall ratings just so we have *a* match
 * to render. Strengths are illustrative, not calibrated.
 */

import type { TeamStrength } from "7a0-engine";

export interface SampleScenario {
  team: string;
  cup: number;
  strength: TeamStrength;
}

export const SAMPLE_SCENARIOS: SampleScenario[] = [
  { team: "Brazil", cup: 1970, strength: { attack: 92, defense: 86, overall: 91 } },
  { team: "Italy", cup: 1982, strength: { attack: 84, defense: 90, overall: 87 } },
  { team: "Argentina", cup: 1986, strength: { attack: 90, defense: 82, overall: 88 } },
  { team: "France", cup: 1998, strength: { attack: 86, defense: 88, overall: 89 } },
  { team: "Spain", cup: 2010, strength: { attack: 88, defense: 87, overall: 90 } },
  { team: "Germany", cup: 2014, strength: { attack: 89, defense: 85, overall: 88 } },
  { team: "Netherlands", cup: 1974, strength: { attack: 88, defense: 80, overall: 85 } },
  { team: "England", cup: 1966, strength: { attack: 80, defense: 84, overall: 82 } },
];

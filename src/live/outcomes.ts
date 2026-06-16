import type { Vec2, Side } from "../types.js";
import type { Rng } from "../rng.js";
import type { LivePlayer, PlayerAttributes } from "./types.js";
import { TACKLE_RANGE } from "./constants.js";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Small random variance — "luck of soccer". */
export function soccerLuck(rng: Rng, spread = 0.08): number {
  return (rng() - 0.5) * spread;
}

/** Team quality delta as a probability nudge (-0.12 .. +0.12). */
export function teamQualityNudge(
  teamOverall: number,
  oppTeamOverall: number,
): number {
  return clamp((teamOverall - oppTeamOverall) / 200, -0.12, 0.12);
}

/** Logistic map from linear score to probability. */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Normalized attacking direction for a side (home attacks +x). */
export function attackDir(side: "home" | "away"): Vec2 {
  return side === "home" ? { x: 1, y: 0 } : { x: -1, y: 0 };
}

export function opponentGoalX(side: "home" | "away"): number {
  return side === "home" ? 1 : 0;
}

/** How open a receiver is: 1 = wide open, 0 = smothered. */
export function openness(
  receiver: LivePlayer,
  defenders: LivePlayer[],
): number {
  let pressure = 0;
  for (const d of defenders) {
    const dDist = dist(receiver.pos, d.pos);
    if (dDist < 0.08) pressure += 1.2;
    else if (dDist < 0.15) pressure += 0.5;
    else if (dDist < 0.25) pressure += 0.15;
  }
  return clamp(1 - pressure * 0.35, 0, 1);
}

export interface PassContext {
  passer: LivePlayer;
  receiver: LivePlayer;
  defenders: LivePlayer[];
  throughBall: boolean;
  teamOverall: number;
  oppTeamOverall: number;
}

/** Pass completion probability before RNG roll. */
export function passSuccessChance(ctx: PassContext): number {
  const distance = dist(ctx.passer.pos, ctx.receiver.pos);
  const open = openness(ctx.receiver, ctx.defenders);
  const passerSkill =
    ctx.passer.attrs.passing * 0.55 + ctx.passer.attrs.intelligence * 0.45;
  const recvSkill =
    ctx.receiver.attrs.intelligence * 0.4 + ctx.receiver.attrs.pace * 0.2;
  const difficulty = distance * 2 + (ctx.throughBall ? 0.3 : 0);
  const pressure = (1 - open) * 1.2;
  const teamNudge = teamQualityNudge(ctx.teamOverall, ctx.oppTeamOverall);
  const x =
    (passerSkill + recvSkill) / 100 -
    difficulty -
    pressure +
    teamNudge +
    0.22;
  return clamp(sigmoid(x * 3.5), 0.08, 0.94);
}

export function rollPassSuccess(rng: Rng, chance: number): boolean {
  return rng() < chance + soccerLuck(rng, 0.06);
}

export interface DribbleContext {
  attacker: LivePlayer;
  defender: LivePlayer | null;
  congestion: number;
  teamOverall: number;
  oppTeamOverall: number;
}

export function dribbleSuccessChance(ctx: DribbleContext): number {
  const atk =
    ctx.attacker.attrs.dribbling * 0.5 +
    ctx.attacker.attrs.pace * 0.3 +
    ctx.attacker.attrs.intelligence * 0.2;
  let def = 50;
  if (ctx.defender) {
    def =
      ctx.defender.attrs.defending * 0.55 +
      ctx.defender.attrs.intelligence * 0.45;
  }
  const teamNudge = teamQualityNudge(ctx.teamOverall, ctx.oppTeamOverall);
  const x =
    (atk - def) / 32 -
    ctx.congestion * 0.7 +
    ctx.attacker.stamina * 0.15 +
    teamNudge;
  return clamp(sigmoid(x * 3), 0.1, 0.9);
}

export interface TackleContext {
  defender: LivePlayer;
  attacker: LivePlayer;
  distance: number;
  teamOverall: number;
  oppTeamOverall: number;
}

export function tackleSuccessChance(ctx: TackleContext): number {
  const def =
    ctx.defender.attrs.defending * 0.6 +
    ctx.defender.attrs.intelligence * 0.4;
  const atk =
    ctx.attacker.attrs.dribbling * 0.4 + ctx.attacker.attrs.pace * 0.3;
  const rangePenalty = clamp((ctx.distance - 0.02) * 8, 0, 0.5);
  const teamNudge = teamQualityNudge(ctx.teamOverall, ctx.oppTeamOverall);
  const x = (def - atk) / 28 - rangePenalty + teamNudge + 0.12;
  return clamp(sigmoid(x * 3.5), 0.08, 0.92);
}

export interface ShotContext {
  shooter: LivePlayer;
  keeper: LivePlayer;
  distanceToGoal: number;
  angleQuality: number;
  pressure: number;
  teamOverall: number;
  oppTeamOverall: number;
}

/** Goal probability for an on-target attempt (before placement noise). */
export function shotGoalChance(ctx: ShotContext): number {
  const shoot =
    ctx.shooter.attrs.shooting * 0.65 +
    ctx.shooter.attrs.intelligence * 0.35;
  const distPenalty = clamp(ctx.distanceToGoal * 1.6, 0, 0.5);
  const angleBonus = ctx.angleQuality * 0.28;
  const pressurePenalty = ctx.pressure * 0.3;
  const teamNudge = teamQualityNudge(ctx.teamOverall, ctx.oppTeamOverall);
  const x = shoot / 100 - distPenalty + angleBonus - pressurePenalty + teamNudge - 0.14;
  return clamp(sigmoid(x * 3.2), 0.04, 0.78);
}

/** Given a shot on target, keeper save probability. */
export function saveChance(ctx: ShotContext): number {
  const gk =
    ctx.keeper.attrs.goalkeeping * 0.7 +
    ctx.keeper.attrs.intelligence * 0.3;
  const shoot =
    ctx.shooter.attrs.shooting * 0.6 +
    ctx.shooter.attrs.intelligence * 0.4;
  const distFactor = clamp(0.35 - ctx.distanceToGoal * 0.5, 0, 0.35);
  const teamNudge = teamQualityNudge(ctx.oppTeamOverall, ctx.teamOverall);
  const x = (gk - shoot) / 38 + distFactor + teamNudge + 0.18;
  return clamp(sigmoid(x * 3.5), 0.12, 0.9);
}

/** Chance the shot is off target (not handled by keeper). */
export function shotOffTargetChance(ctx: ShotContext): number {
  const shoot = ctx.shooter.attrs.shooting / 100;
  const distPenalty = clamp(ctx.distanceToGoal * 0.7, 0, 0.35);
  const pressure = ctx.pressure * 0.22;
  return clamp(0.28 - shoot * 0.2 + distPenalty + pressure, 0.04, 0.38);
}

export function angleQuality(
  shooterPos: Vec2,
  goalX: number,
): number {
  const midY = 0.5;
  const dy = Math.abs(shooterPos.y - midY);
  return clamp(1 - dy * 2.5, 0, 1);
}

export function nearestDefender(
  pos: Vec2,
  defenders: LivePlayer[],
): LivePlayer | null {
  let best: LivePlayer | null = null;
  let bestD = Infinity;
  for (const d of defenders) {
    const dd = dist(pos, d.pos);
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

export function countNearby(
  pos: Vec2,
  players: LivePlayer[],
  radius: number,
): number {
  let n = 0;
  for (const p of players) {
    if (dist(pos, p.pos) < radius) n++;
  }
  return n;
}

/** Stamina multiplier affecting physical outcomes. */
export function staminaFactor(attrs: PlayerAttributes, stamina: number): number {
  return 0.7 + 0.3 * stamina * (attrs.stamina / 100);
}

/** Roll with soccer luck applied to a base probability. */
export function rollOutcome(rng: Rng, chance: number): boolean {
  return rng() < clamp(chance + soccerLuck(rng, 0.07), 0.02, 0.98);
}

export interface LooseBallContext {
  player: LivePlayer;
  distance: number;
  teamOverall: number;
  oppTeamOverall: number;
}

/** Pickup win score for a loose ball (higher = more likely to win contest). */
export function looseBallContestScore(ctx: LooseBallContext): number {
  const skill =
    ctx.player.attrs.pace * 0.35 +
    ctx.player.attrs.intelligence * 0.35 +
    ctx.player.attrs.dribbling * 0.2 +
    ctx.player.attrs.defending * 0.1;
  const teamNudge = teamQualityNudge(ctx.teamOverall, ctx.oppTeamOverall) * 100;
  const distPenalty = ctx.distance * 180;
  return skill + teamNudge - distPenalty;
}

export interface CrossContext {
  crosser: LivePlayer;
  target: LivePlayer;
  defenders: LivePlayer[];
  teamOverall: number;
  oppTeamOverall: number;
}

/** Cross delivery success before aerial contest. */
export function crossDeliveryChance(ctx: CrossContext): number {
  const crossSkill =
    ctx.crosser.attrs.passing * 0.5 + ctx.crosser.attrs.intelligence * 0.5;
  const pressure = (1 - openness(ctx.target, ctx.defenders)) * 1.1;
  const teamNudge = teamQualityNudge(ctx.teamOverall, ctx.oppTeamOverall);
  const x = crossSkill / 100 - pressure * 0.35 + teamNudge + 0.18;
  return clamp(sigmoid(x * 3.2), 0.1, 0.88);
}

/** Aerial contest win for attacker vs nearest defender. */
export function aerialContestChance(
  attacker: LivePlayer,
  defender: LivePlayer | null,
  teamOverall: number,
  oppTeamOverall: number,
): number {
  const atk =
    attacker.attrs.shooting * 0.35 +
    attacker.attrs.intelligence * 0.35 +
    attacker.attrs.pace * 0.3;
  let def = 45;
  if (defender) {
    def =
      defender.attrs.defending * 0.55 +
      defender.attrs.intelligence * 0.45;
  }
  const teamNudge = teamQualityNudge(teamOverall, oppTeamOverall);
  const x = (atk - def) / 30 + teamNudge + 0.08;
  return clamp(sigmoid(x * 3), 0.12, 0.85);
}

export interface FoulContext {
  defender: LivePlayer;
  attacker: LivePlayer;
  distance: number;
}

/** Foul probability when a tackle fails. */
export function foulOnTackleChance(ctx: FoulContext): number {
  const aggression = (100 - ctx.defender.attrs.intelligence) / 100;
  const rangeFactor = clamp((TACKLE_RANGE - ctx.distance) / TACKLE_RANGE, 0, 1);
  return clamp(0.06 + aggression * 0.12 + rangeFactor * 0.08, 0.04, 0.32);
}

/** In-play penalty conversion probability. */
export function penaltyKickChance(
  taker: LivePlayer,
  keeper: LivePlayer,
  teamOverall: number,
  oppTeamOverall: number,
): number {
  const shoot =
    taker.attrs.shooting * 0.65 + taker.attrs.intelligence * 0.35;
  const gk =
    keeper.attrs.goalkeeping * 0.7 + keeper.attrs.intelligence * 0.3;
  const teamNudge = teamQualityNudge(teamOverall, oppTeamOverall);
  const x = (shoot - gk) / 35 + teamNudge + 0.22;
  return clamp(sigmoid(x * 3.2), 0.55, 0.92);
}

/** Whether a foul spot is inside the attacking penalty area. */
export function isInPenaltyBox(pos: Vec2, attackingSide: Side): boolean {
  if (attackingSide === "home") {
    return (
      pos.x >= 1 - 0.18 &&
      pos.y >= 0.5 - 0.15 &&
      pos.y <= 0.5 + 0.15
    );
  }
  return (
    pos.x <= 0.18 &&
    pos.y >= 0.5 - 0.15 &&
    pos.y <= 0.5 + 0.15
  );
}

/** Normalized penalty spot for attacking side. */
export function penaltySpot(attackingSide: Side): Vec2 {
  return attackingSide === "home"
    ? { x: 1 - 0.11, y: 0.5 }
    : { x: 0.11, y: 0.5 };
}

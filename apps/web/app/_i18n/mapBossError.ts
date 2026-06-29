import type { StringCatalog } from "./types";

const CODES = {
  ALREADY_TRIED: "BOSS_ALREADY_TRIED_TODAY",
  MALFORMED: "BOSS_MALFORMED_BUILD",
  INVALID_PREFIX: "BOSS_INVALID_BUILD:",
} as const;

export function bossErrorCode(
  kind: "alreadyTried" | "malformed" | "invalidBuild",
  details?: string,
): string {
  switch (kind) {
    case "alreadyTried":
      return CODES.ALREADY_TRIED;
    case "malformed":
      return CODES.MALFORMED;
    case "invalidBuild":
      return details ? `${CODES.INVALID_PREFIX}${details}` : CODES.INVALID_PREFIX;
  }
}

/** Map a Convex boss error (code or legacy English) to localized UI text. */
export function mapBossError(message: string, S: StringCatalog): string {
  if (message === CODES.ALREADY_TRIED) return S.errors.boss.alreadyTriedToday;
  if (message === CODES.MALFORMED) return S.errors.boss.malformedBuild;
  if (message.startsWith(CODES.INVALID_PREFIX)) {
    const details = message.slice(CODES.INVALID_PREFIX.length);
    return S.errors.invalidBuild(details);
  }
  if (message === "You've already challenged the Boss today.") {
    return S.errors.boss.alreadyTriedToday;
  }
  if (message === "Malformed build: actions could not be parsed") {
    return S.errors.boss.malformedBuild;
  }
  if (message.startsWith("Invalid build: ")) {
    return S.errors.invalidBuild(message.slice("Invalid build: ".length));
  }
  return S.errors.bossChallengeFailed;
}

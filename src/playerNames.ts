/** Fjelstul placeholder values that are not real name parts. */
const PLACEHOLDER_NAME = /^(not applicable|n\/a|na)$/i;

function isPlaceholderNamePart(part: string): boolean {
  return PLACEHOLDER_NAME.test(part.trim());
}

/** Remove Fjelstul "not applicable" prefix from an already joined display name. */
export function cleanPlayerDisplayName(name: string): string {
  const trimmed = name.trim();
  const cleaned = trimmed.replace(/^not applicable\s+/i, "").trim();
  return cleaned || trimmed || "Unknown";
}

/** Build a display name from Fjelstul given + family fields. */
export function playerDisplayNameFromParts(given: string, family: string): string {
  const parts = [given.trim(), family.trim()].filter(
    (p) => p.length > 0 && !isPlaceholderNamePart(p),
  );
  if (parts.length === 0) return "Unknown";
  return cleanPlayerDisplayName(parts.join(" "));
}

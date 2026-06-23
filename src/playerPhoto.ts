import { cleanPlayerDisplayName } from "./playerNames.js";

/** How a player headshot URL was sourced. */
export type PhotoSource = "wikimedia" | "curated" | "external";

/** Build a Wikimedia Commons thumbnail URL from a P18 filename. */
export function commonsThumbUrl(filename: string, width = 128): string {
  const clean = filename.replace(/^File:/i, "").trim();
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(clean)}?width=${width}`;
}

/** Surname or two-letter initials for avatar fallback. */
export function playerInitials(name: string): string {
  const cleaned = cleanPlayerDisplayName(name);
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Whether an existing photo should block Wikimedia overwrite. */
export function photoIsProtected(source: PhotoSource | undefined): boolean {
  return source === "curated" || source === "external";
}

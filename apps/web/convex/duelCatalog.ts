/**
 * The single catalog the duel is played on, shared byte-for-byte by the server
 * (this module) and the duel client (`app/duel`). Determinism of the shared
 * draft seed depends on both sides rolling scenarios from the *identical*
 * scenario list — so the online duel uses the engine's bundled `demoCatalog`
 * directly (no app-side overlays).
 *
 * Imported from the built engine (`7a0-engine/dist`) so Convex's esbuild bundler
 * resolves plain `.js` specifiers. Run `pnpm build` (root) before `convex dev`.
 *
 * Follow-up: to play the full 5,729-player catalog online, store it server-side
 * (Convex storage) and load it here instead of the demo set.
 */
import { demoCatalog, type SquadCatalog } from "7a0-engine/dist";

export const duelCatalog: SquadCatalog = demoCatalog;

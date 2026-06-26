/**
 * The catalog the M6 solo / Missions / Boss features are played on.
 *
 * Unlike the duel (which plays on the raw `duelCatalog`), the solo experience
 * loads the catalog through `prepareGameCatalog` — curated overlays plus legend
 * photos (`app/_hooks/useGameCatalog.ts`). Mission progress credits *any* solo
 * match, so the server must re-resolve those matches on a byte-identical
 * catalog or the replayed action log would roll different scenarios / strengths.
 * This module reproduces `prepareGameCatalog` exactly, server-side, so a
 * client-built draft replays deterministically and the engine result matches
 * what the player saw.
 */
import {
  applyLegendPhotosToCatalog,
  hydrateCatalog,
  overlayRawExportOnCatalog,
  type SquadCatalog,
} from "7a0-engine/dist";
import fullCatalog from "../public/catalog.json";
import { CURATED_SQUAD_OVERLAYS } from "../app/_data/curatedOverlays";

const { catalog: patched } = overlayRawExportOnCatalog(
  hydrateCatalog(fullCatalog as unknown as SquadCatalog),
  CURATED_SQUAD_OVERLAYS,
);

/** Same pipeline as the solo client's `prepareGameCatalog`. */
export const gameCatalog: SquadCatalog = applyLegendPhotosToCatalog(
  hydrateCatalog(patched),
);

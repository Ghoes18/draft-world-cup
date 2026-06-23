import type { RawCatalogExport } from "7a0-engine";
import argentina1986 from "../../../../squads/curated/argentina-1986.json";
import brazil1970 from "../../../../squads/curated/brazil-1970.json";

/** Curated squad patches (photos, positions, overall) applied at catalog load time. */
export const CURATED_SQUAD_OVERLAYS = [
  brazil1970,
  argentina1986,
] as RawCatalogExport[];

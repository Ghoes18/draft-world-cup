/**
 * Demo squad catalog — full squads with autoral `force` values (0–255).
 *
 * TODO(data): replace via `pnpm import:squads` when licensed squad JSON exists.
 */

import { normalizeCatalog, type SquadCatalog } from "./catalog.js";

const raw = {
  scenarios: [
    {
      id: "brazil-1970",
      team: "Brazil",
      cup: 1970,
      players: [
        { id: "br70-felix", name: "Félix", naturalPosition: "GK", shirtNumber: 1, force: 210 },
        { id: "br70-carlos-alberto", name: "Carlos Alberto", naturalPosition: "RB", shirtNumber: 4, force: 238 },
        { id: "br70-brito", name: "Brito", naturalPosition: "RCB", shirtNumber: 2, force: 220 },
        { id: "br70-piazza", name: "Piazza", naturalPosition: "LCB", shirtNumber: 3, force: 225 },
        { id: "br70-everaldo", name: "Everaldo", naturalPosition: "LB", shirtNumber: 6, force: 222 },
        { id: "br70-clodoaldo", name: "Clodoaldo", naturalPosition: "RCM", shirtNumber: 5, force: 228 },
        { id: "br70-gerson", name: "Gerson", naturalPosition: "CM", shirtNumber: 8, force: 232 },
        { id: "br70-rivellino", name: "Rivelino", naturalPosition: "LCM", shirtNumber: 10, force: 235 },
        { id: "br70-jairzinho", name: "Jairzinho", naturalPosition: "RW", shirtNumber: 7, force: 240 },
        { id: "br70-pelé", name: "Pelé", naturalPosition: "ST", shirtNumber: 9, force: 245 },
        { id: "br70-tostao", name: "Tostão", naturalPosition: "LW", shirtNumber: 11, force: 236 },
        { id: "br70-leao", name: "Leão", naturalPosition: "GK", shirtNumber: 12, force: 198 },
        { id: "br70-bellini", name: "Bellini", naturalPosition: "CB", shirtNumber: 13, force: 205 },
        { id: "br70-edú", name: "Edu", naturalPosition: "CM", shirtNumber: 14, force: 212 },
        { id: "br70-waltencir", name: "Waltencir", naturalPosition: "ST", shirtNumber: 15, force: 200 },
        { id: "br70-joao", name: "João", naturalPosition: "GK", shirtNumber: 22, force: 185 },
        { id: "br70-baldocchi", name: "Baldocchi", naturalPosition: "CB", shirtNumber: 16, force: 190 },
        { id: "br70-felix-alt", name: "Marco Antônio", naturalPosition: "RB", shirtNumber: 17, force: 195 },
        { id: "br70-roberto", name: "Roberto", naturalPosition: "LB", shirtNumber: 18, force: 192 },
        { id: "br70-dario", name: "Dario", naturalPosition: "ST", shirtNumber: 19, force: 188 },
        { id: "br70-resendes", name: "Resende", naturalPosition: "CM", shirtNumber: 20, force: 182 },
        { id: "br70-zagallo", name: "Zagallo", naturalPosition: "LW", shirtNumber: 21, force: 215 },
      ],
    },
    {
      id: "italy-1982",
      team: "Italy",
      cup: 1982,
      players: [
        { id: "it82-zoff", name: "Zoff", naturalPosition: "GK", shirtNumber: 1, force: 228 },
        { id: "it82-gentile", name: "Gentile", naturalPosition: "RB", shirtNumber: 8, force: 218 },
        { id: "it82-scirea", name: "Scirea", naturalPosition: "RCB", shirtNumber: 5, force: 232 },
        { id: "it82-cabrini", name: "Cabrini", naturalPosition: "LB", shirtNumber: 3, force: 220 },
        { id: "it82-collovati", name: "Collovati", naturalPosition: "LCB", shirtNumber: 6, force: 215 },
        { id: "it82-antognoni", name: "Antognoni", naturalPosition: "CM", shirtNumber: 10, force: 222 },
        { id: "it82-tardelli", name: "Tardelli", naturalPosition: "RCM", shirtNumber: 11, force: 225 },
        { id: "it82-rossi", name: "Rossi", naturalPosition: "ST", shirtNumber: 9, force: 238 },
        { id: "it82-conti", name: "Conti", naturalPosition: "RW", shirtNumber: 7, force: 218 },
        { id: "it82-graziani", name: "Graziani", naturalPosition: "LW", shirtNumber: 12, force: 215 },
        { id: "it82-oriani", name: "Oriani", naturalPosition: "LCM", shirtNumber: 14, force: 210 },
        { id: "it82-buffon", name: "Buffon", naturalPosition: "GK", shirtNumber: 22, force: 175 },
        { id: "it82-baresi", name: "Baresi", naturalPosition: "CB", shirtNumber: 4, force: 205 },
        { id: "it82-altobelli", name: "Altobelli", naturalPosition: "ST", shirtNumber: 18, force: 228 },
        { id: "it82-vierchowod", name: "Vierchowod", naturalPosition: "CB", shirtNumber: 15, force: 212 },
        { id: "it82-bergomi", name: "Bergomi", naturalPosition: "CB", shirtNumber: 2, force: 208 },
        { id: "it82-oriali", name: "Oriali", naturalPosition: "DM", shirtNumber: 13, force: 200 },
        { id: "it82-marini", name: "Marini", naturalPosition: "CM", shirtNumber: 16, force: 195 },
        { id: "it82-salceti", name: "Salceti", naturalPosition: "CB", shirtNumber: 17, force: 188 },
        { id: "it82-vignola", name: "Vignola", naturalPosition: "LB", shirtNumber: 19, force: 185 },
        { id: "it82-serena", name: "Serena", naturalPosition: "ST", shirtNumber: 20, force: 192 },
        { id: "it82-dino", name: "Dino", naturalPosition: "CM", shirtNumber: 21, force: 180 },
      ],
    },
    {
      id: "argentina-1986",
      team: "Argentina",
      cup: 1986,
      players: [
        { id: "ar86-pumpido", name: "Pumpido", naturalPosition: "GK", shirtNumber: 18, force: 218 },
        { id: "ar86-batista", name: "Batista", naturalPosition: "RCB", shirtNumber: 2, force: 210 },
        { id: "ar86-brown", name: "Brown", naturalPosition: "LCB", shirtNumber: 5, force: 215 },
        { id: "ar86-ruggeri", name: "Ruggeri", naturalPosition: "CB", shirtNumber: 19, force: 212 },
        { id: "ar86-burruchaga", name: "Burruchaga", naturalPosition: "RCM", shirtNumber: 7, force: 228 },
        { id: "ar86-enrique", name: "Enrique", naturalPosition: "CM", shirtNumber: 12, force: 218 },
        { id: "ar86-maradona", name: "Maradona", naturalPosition: "AM", shirtNumber: 10, force: 248 },
        { id: "ar86-valdano", name: "Valdano", naturalPosition: "ST", shirtNumber: 11, force: 232 },
        { id: "ar86-giusti", name: "Giusti", naturalPosition: "DM", shirtNumber: 14, force: 208 },
        { id: "ar86-olarticoechea", name: "Olarticoechea", naturalPosition: "LB", shirtNumber: 16, force: 205 },
        { id: "ar86-cuciuffo", name: "Cuciuffo", naturalPosition: "RB", shirtNumber: 9, force: 212 },
        { id: "ar86-tapia", name: "Tapia", naturalPosition: "CM", shirtNumber: 21, force: 200 },
        { id: "ar86-sergio", name: "Sergio Batista", naturalPosition: "DM", shirtNumber: 6, force: 202 },
        { id: "ar86-calderon", name: "Calderón", naturalPosition: "ST", shirtNumber: 17, force: 195 },
        { id: "ar86-borghi", name: "Borghi", naturalPosition: "AM", shirtNumber: 20, force: 198 },
        { id: "ar86-nery", name: "Nery Pumpido", naturalPosition: "GK", shirtNumber: 1, force: 190 },
        { id: "ar86-islas", name: "Islas", naturalPosition: "GK", shirtNumber: 22, force: 185 },
        { id: "ar86-passarella", name: "Passarella", naturalPosition: "CB", shirtNumber: 3, force: 220 },
        { id: "ar86-clausen", name: "Clausen", naturalPosition: "ST", shirtNumber: 13, force: 188 },
        { id: "ar86-albaladejo", name: "Albaladejo", naturalPosition: "LB", shirtNumber: 15, force: 182 },
        { id: "ar86-garza", name: "Garza", naturalPosition: "CM", shirtNumber: 4, force: 178 },
        { id: "ar86-lorente", name: "Lorente", naturalPosition: "CB", shirtNumber: 8, force: 192 },
      ],
    },
  ],
};

/** Demo catalog — not the full live-game dataset. */
export const demoCatalog: SquadCatalog = normalizeCatalog(raw);

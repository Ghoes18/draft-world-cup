import type { Locale } from "./types.js";

export interface MissionCopy {
  title: string;
  description: string;
}

export const MISSION_COPY: Record<string, Record<Locale, MissionCopy>> = {
  "d-win-margin-3": {
    en: { title: "Statement win", description: "Win a match by 3 goals or more." },
    pt: { title: "Vitória contundente", description: "Ganha um jogo por 3 ou mais golos de diferença." },
    es: { title: "Victoria contundente", description: "Gana un partido por 3 o más goles de diferencia." },
  },
  "d-clean-sheet": {
    en: { title: "Lock at the back", description: "Finish a match without conceding." },
    pt: { title: "Defesa fechada", description: "Termina um jogo sem sofrer golos." },
    es: { title: "Portería a cero", description: "Termina un partido sin encajar." },
  },
  "d-rout-5": {
    en: { title: "Rout", description: "Win a match 5–0 or better." },
    pt: { title: "Goleada", description: "Ganha um jogo por 5–0 ou melhor." },
    es: { title: "Paliza", description: "Gana un partido por 5–0 o mejor." },
  },
  "d-comp-brazil": {
    en: { title: "Samba XI", description: "Field 3+ Brazil players in one match." },
    pt: { title: "Samba XI", description: "Alinha 3+ jogadores do Brasil num jogo." },
    es: { title: "Samba XI", description: "Alinea 3+ jugadores de Brasil en un partido." },
  },
  "d-comp-italy": {
    en: { title: "Catenaccio", description: "Field 3+ Italy players in one match." },
    pt: { title: "Catenaccio", description: "Alinha 3+ jogadores de Itália num jogo." },
    es: { title: "Catenaccio", description: "Alinea 3+ jugadores de Italia en un partido." },
  },
  "d-comp-germany": {
    en: { title: "Die Mannschaft", description: "Field 3+ Germany players in one match." },
    pt: { title: "Die Mannschaft", description: "Alinha 3+ jogadores da Alemanha num jogo." },
    es: { title: "Die Mannschaft", description: "Alinea 3+ jugadores de Alemania en un partido." },
  },
  "d-comp-argentina": {
    en: { title: "Albiceleste", description: "Field 3+ Argentina players in one match." },
    pt: { title: "Albiceleste", description: "Alinha 3+ jogadores da Argentina num jogo." },
    es: { title: "Albiceleste", description: "Alinea 3+ jugadores de Argentina en un partido." },
  },
  "p-seven-nil": {
    en: { title: "Sete a Zero", description: "Win a match 7–0." },
    pt: { title: "Sete a Zero", description: "Ganha um jogo por 7–0." },
    es: { title: "Sete a Zero", description: "Gana un partido por 7–0." },
  },
  "p-beat-boss": {
    en: { title: "Giant killer", description: "Beat the weekly Boss." },
    pt: { title: "Matador de gigantes", description: "Vence o Boss semanal." },
    es: { title: "Gigante asesino", description: "Vence al Boss semanal." },
  },
  "p-goal-machine": {
    en: { title: "Goal machine", description: "Score 50 goals across your matches." },
    pt: { title: "Máquina de golos", description: "Marca 50 golos nos teus jogos." },
    es: { title: "Máquina de goles", description: "Marca 50 goles en tus partidos." },
  },
  "p-serial-winner": {
    en: { title: "Serial winner", description: "Win 10 matches." },
    pt: { title: "Vencedor em série", description: "Ganha 10 jogos." },
    es: { title: "Ganador en serie", description: "Gana 10 partidos." },
  },
  "p-two-goats": {
    en: { title: "2 GOATs", description: "Field both Cristiano Ronaldo and Messi (across matches)." },
    pt: { title: "2 GOATs", description: "Alinha Cristiano Ronaldo e Messi (em jogos diferentes)." },
    es: { title: "2 GOATs", description: "Alinea a Cristiano Ronaldo y Messi (en partidos distintos)." },
  },
  "p-hall-of-fame": {
    en: { title: "Hall of Fame", description: "Field 5 different legends." },
    pt: { title: "Hall of Fame", description: "Alinha 5 lendas diferentes." },
    es: { title: "Hall of Fame", description: "Alinea 5 leyendas distintas." },
  },
};

export function missionCopy(
  id: string,
  locale: Locale,
  fallback?: MissionCopy,
): MissionCopy {
  const row = MISSION_COPY[id]?.[locale] ?? MISSION_COPY[id]?.en;
  if (row) return row;
  if (fallback) return fallback;
  return { title: id, description: "" };
}

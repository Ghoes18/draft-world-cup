import type { Locale } from "./types.js";

export interface BossCopy {
  name: string;
  subtitle: string;
}

export const BOSS_COPY: Record<string, Record<Locale, BossCopy>> = {
  "best-of-90s": {
    en: {
      name: "The Best of 90s",
      subtitle: "Zidane, Ronaldo, Maldini and the decade that never ended.",
    },
    pt: {
      name: "O melhor dos anos 90",
      subtitle: "Zidane, Ronaldo, Maldini e a década que nunca acabou.",
    },
    es: {
      name: "Lo mejor de los 90",
      subtitle: "Zidane, Ronaldo, Maldini y la década que nunca terminó.",
    },
  },
  "best-of-brazil": {
    en: {
      name: "The Best of Brazil",
      subtitle: "Pelé, Ronaldo, Ronaldinho — the impossible yellow wall.",
    },
    pt: {
      name: "O melhor do Brasil",
      subtitle: "Pelé, Ronaldo, Ronaldinho — o muro amarelo impossível.",
    },
    es: {
      name: "Lo mejor de Brasil",
      subtitle: "Pelé, Ronaldo, Ronaldinho — el muro amarillo imposible.",
    },
  },
  "total-football-ghosts": {
    en: {
      name: "Total Football Ghosts",
      subtitle: "Cruyff's heirs — press, pass, and punish.",
    },
    pt: {
      name: "Fantasmas do Futebol Total",
      subtitle: "Herdeiros de Cruyff — pressiona, passa e castiga.",
    },
    es: {
      name: "Fantasmas del Fútbol Total",
      subtitle: "Herederos de Cruyff — presiona, pasa y castiga.",
    },
  },
  "catenaccio-immortale": {
    en: {
      name: "Catenaccio Immortale",
      subtitle: "Baresi, Maldini, Cannavaro — score if you dare.",
    },
    pt: {
      name: "Catenaccio Immortale",
      subtitle: "Baresi, Maldini, Cannavaro — marca se tiveres coragem.",
    },
    es: {
      name: "Catenaccio Immortale",
      subtitle: "Baresi, Maldini, Cannavaro — marca si te atreves.",
    },
  },
  "la-albiceleste-mythos": {
    en: {
      name: "La Albiceleste Mythos",
      subtitle: "Maradona and Messi — two gods, one shirt.",
    },
    pt: {
      name: "O mito da Albiceleste",
      subtitle: "Maradona e Messi — dois deuses, uma camisola.",
    },
    es: {
      name: "El mito de la Albiceleste",
      subtitle: "Maradona y Messi — dos dioses, una camiseta.",
    },
  },
  "galacticos-without-borders": {
    en: {
      name: "Galácticos Without Borders",
      subtitle: "Attack is the only language they speak.",
    },
    pt: {
      name: "Galácticos sem fronteiras",
      subtitle: "Atacar é a única língua que falam.",
    },
    es: {
      name: "Galácticos sin fronteras",
      subtitle: "Atacar es el único idioma que hablan.",
    },
  },
  "wall-of-europe": {
    en: {
      name: "Wall of Europe",
      subtitle: "Neuer, Buffon, Casillas — clean sheets are the trophy.",
    },
    pt: {
      name: "Muralha da Europa",
      subtitle: "Neuer, Buffon, Casillas — baliza a zero é o troféu.",
    },
    es: {
      name: "Muro de Europa",
      subtitle: "Neuer, Buffon, Casillas — la portería a cero es el trofeo.",
    },
  },
  "kings-of-the-final": {
    en: {
      name: "Kings of the Final",
      subtitle: "Men who only showed up when the trophy was on the line.",
    },
    pt: {
      name: "Reis da final",
      subtitle: "Homens que só apareciam quando o troféu estava em jogo.",
    },
    es: {
      name: "Reyes de la final",
      subtitle: "Hombres que solo aparecían cuando el trofeo estaba en juego.",
    },
  },
  "left-footed-curse": {
    en: {
      name: "The Left-Footed Curse",
      subtitle: "Messi, Maradona, Rivaldo — beauty bends left.",
    },
    pt: {
      name: "A maldição do pé esquerdo",
      subtitle: "Messi, Maradona, Rivaldo — a beleza curva à esquerda.",
    },
    es: {
      name: "La maldición del zurdo",
      subtitle: "Messi, Maradona, Rivaldo — la belleza se inclina a la izquierda.",
    },
  },
  "chaos-xi": {
    en: {
      name: "Chaos XI",
      subtitle: "Five up front, three at the back — pure madness.",
    },
    pt: {
      name: "Chaos XI",
      subtitle: "Cinco à frente, três atrás — pura loucura.",
    },
    es: {
      name: "Chaos XI",
      subtitle: "Cinco arriba, tres atrás — pura locura.",
    },
  },
};

export function bossCopy(id: string, locale: Locale, fallback?: BossCopy): BossCopy {
  const row = BOSS_COPY[id]?.[locale] ?? BOSS_COPY[id]?.en;
  if (row) return row;
  if (fallback) return fallback;
  return { name: id, subtitle: "" };
}

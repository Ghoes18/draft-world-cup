"use client";

import { useEffect, useState } from "react";

const ID_KEY = "duel.playerId";
const NAME_KEY = "duel.playerName";

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `p-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/**
 * A stable, anonymous player identity persisted in localStorage. MVP stand-in
 * for better-auth (PRD §9.5) — enough to identify a seat across reconnects.
 */
export function usePlayerId(): {
  playerId: string | null;
  name: string;
  setName: (n: string) => void;
} {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [name, setNameState] = useState<string>("");

  useEffect(() => {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(ID_KEY, id);
    }
    setPlayerId(id);

    let stored = localStorage.getItem(NAME_KEY);
    if (!stored) {
      stored = `Coach ${id.slice(0, 4).toUpperCase()}`;
      localStorage.setItem(NAME_KEY, stored);
    }
    setNameState(stored);
  }, []);

  function setName(n: string) {
    setNameState(n);
    localStorage.setItem(NAME_KEY, n);
  }

  return { playerId, name, setName };
}

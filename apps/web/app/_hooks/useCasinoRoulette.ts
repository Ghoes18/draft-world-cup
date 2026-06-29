"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./useMotionPreference";

export type CasinoRouletteOptions<T> = {
  pool: readonly T[];
  target: T;
  /** Changing this restarts the spin. */
  spinKey: string | number;
  getId: (item: T) => string;
  durationMs?: number;
};

export function useCasinoRoulette<T>({
  pool,
  target,
  spinKey,
  getId,
  durationMs = 2200,
}: CasinoRouletteOptions<T>) {
  const reducedMotion = usePrefersReducedMotion();
  const targetId = getId(target);

  const poolRef = useRef(pool);
  const targetRef = useRef(target);
  const getIdRef = useRef(getId);
  poolRef.current = pool;
  targetRef.current = target;
  getIdRef.current = getId;

  const [display, setDisplay] = useState(target);
  const [trail, setTrail] = useState<T[]>([target]);
  const [spinning, setSpinning] = useState(false);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const currentPool = poolRef.current;
    const currentTarget = targetRef.current;
    const readId = getIdRef.current;

    if (reducedMotion || currentPool.length === 0) {
      setDisplay(currentTarget);
      setTrail([currentTarget]);
      setSpinning(false);
      setFrame(0);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastId = readId(currentTarget);
    let frameCount = 0;
    setSpinning(true);
    setFrame(0);

    const pickRandom = (): T => {
      if (currentPool.length === 1) return currentPool[0]!;
      let item = currentPool[Math.floor(Math.random() * currentPool.length)]!;
      let guard = 0;
      while (readId(item) === lastId && guard++ < 8) {
        item = currentPool[Math.floor(Math.random() * currentPool.length)]!;
      }
      return item;
    };

    const start = performance.now();

    const step = (now: number) => {
      if (cancelled) return;

      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const easeOut = 1 - (1 - progress) ** 3;

      if (progress >= 1) {
        setDisplay(currentTarget);
        setTrail([currentTarget]);
        setSpinning(false);
        setFrame(0);
        return;
      }

      const next =
        progress > 0.78 && Math.random() > (1 - progress) * 3.5
          ? currentTarget
          : pickRandom();

      lastId = readId(next);
      frameCount += 1;
      setFrame(frameCount);
      setDisplay(next);
      setTrail((prev) => {
        const merged = [
          next,
          ...prev.filter((item) => readId(item) !== readId(next)),
        ];
        return merged.slice(0, 3);
      });

      const interval = 42 + (260 - 42) * easeOut;
      timeoutId = setTimeout(() => step(performance.now()), interval);
    };

    timeoutId = setTimeout(() => step(performance.now()), 0);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [spinKey, targetId, reducedMotion, durationMs]);

  return { display, trail, spinning, reducedMotion, frame };
}

"use client";

import { useEffect, useRef, useState } from "react";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

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

  useEffect(() => {
    const currentPool = poolRef.current;
    const currentTarget = targetRef.current;
    const readId = getIdRef.current;

    if (reducedMotion || currentPool.length === 0) {
      setDisplay(currentTarget);
      setTrail([currentTarget]);
      setSpinning(false);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastId = readId(currentTarget);
    setSpinning(true);

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

    const tick = (now: number) => {
      if (cancelled) return;

      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const easeOut = 1 - (1 - progress) ** 3;

      if (progress >= 1) {
        setDisplay(currentTarget);
        setTrail([currentTarget]);
        setSpinning(false);
        return;
      }

      const next =
        progress > 0.78 && Math.random() > (1 - progress) * 3.5
          ? currentTarget
          : pickRandom();

      lastId = readId(next);
      setDisplay(next);
      setTrail((prev) => {
        const merged = [
          next,
          ...prev.filter((item) => readId(item) !== readId(next)),
        ];
        return merged.slice(0, 3);
      });

      const interval = 42 + (260 - 42) * easeOut;
      timeoutId = setTimeout(() => tick(performance.now()), interval);
    };

    timeoutId = setTimeout(() => tick(performance.now()), 0);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [spinKey, targetId, reducedMotion, durationMs]);

  return { display, trail, spinning, reducedMotion };
}

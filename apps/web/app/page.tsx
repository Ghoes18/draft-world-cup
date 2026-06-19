"use client";

import { useState } from "react";
import {
  simulateMatch,
  generateTimeline,
  defaultLineup,
  type MatchTimeline,
} from "7a0-engine";
import { MatchView } from "./_components/MatchView";
import { SAMPLE_SCENARIOS, type SampleScenario } from "./_data/scenarios";
import { STRINGS as S } from "./_data/strings";

interface Fixture {
  home: SampleScenario;
  away: SampleScenario;
  seed: string;
}

function rollFixture(): Fixture {
  const i = Math.floor(Math.random() * SAMPLE_SCENARIOS.length);
  let j = Math.floor(Math.random() * SAMPLE_SCENARIOS.length);
  if (j === i) j = (j + 1) % SAMPLE_SCENARIOS.length;
  const seed = Math.random().toString(36).slice(2, 10);
  return { home: SAMPLE_SCENARIOS[i]!, away: SAMPLE_SCENARIOS[j]!, seed };
}

export default function Page() {
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [timeline, setTimeline] = useState<MatchTimeline | null>(null);

  function onRoll() {
    setFixture(rollFixture());
    setTimeline(null);
  }

  function onSimulate() {
    if (!fixture) return;
    const { home, away, seed } = fixture;
    // Solo M2: client-side simulate is fine. Online/daily move this server-side (M5/M7).
    const result = simulateMatch({
      home: home.strength,
      away: away.strength,
      seed,
      knockout: false,
    });
    const next = generateTimeline({
      result,
      seed,
      scenario: { team: home.team, cup: home.cup },
      lineups: { home: defaultLineup("home"), away: defaultLineup("away") },
    });
    setTimeline(next);
  }

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <h1 style={{ marginBottom: "0.25rem" }}>{S.title}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>{S.subtitle}</p>

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", margin: "1.25rem 0" }}>
        <button onClick={onRoll}>{S.roll}</button>
        {fixture && (
          <>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              <strong>{fixture.home.team}</strong> {fixture.home.cup} {S.vs}{" "}
              <strong>{fixture.away.team}</strong> {fixture.away.cup}
            </span>
            <button onClick={onSimulate}>{S.simulate}</button>
          </>
        )}
      </div>

      {timeline && fixture ? (
        // key on seed so a fresh simulate resets the ticker.
        <MatchView
          key={timeline.seed}
          timeline={timeline}
          labels={{ home: fixture.home.team, away: fixture.away.team }}
        />
      ) : (
        <p style={{ color: "var(--muted)" }}>{S.noMatch}</p>
      )}
    </main>
  );
}

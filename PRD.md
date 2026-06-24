## 1. Executive summary

7a0 is a web football game themed around World Cup history (1950–2026). Today it is essentially a **solo, asynchronous** experience: the player "rolls the dice", builds a starting XI from real players who featured in that edition, and simulates a tournament campaign trying to win **7–0**. Existing "multiplayer" modes (Local, Cup Final, Knockout) work by **sharing a code/seed** — there is no real-time networked play.

This document specifies three upgrades:

1. **A tiered text presentation** — the same match result can be shown as **minute-by-minute text** (Fast) or as an **instant result** (Ultra Fast).
2. **A true online mode** — players on different devices, connected in real time, with **server-authoritative simulation** (mandatory, because the current engine is client-side and seed-deterministic and would be trivial to manipulate), plus matchmaking, ranking and rematches.
3. **Social features** — shareable highlights, match statistics, chemistry, tactics, and daily challenge (see MVP).

The architectural spine that makes all of this tractable: **decouple the result from its presentation**. The engine decides the numbers first; everything visible is a *replay of a pre-decided result* — **not** a live physics or player-AI simulation that decides goals during play.

### 1.1 Implementation repository

Core simulation code lives in this monorepo/package (**`draft-world-cup`** / `7a0-engine`):

- **M1 complete:** Poisson engine, timeline generator, Fast-text consumer, CLI (`pnpm sim`), vitest suite.
- **Presentation:** text-only (Fast ticker + Ultra Fast instant), like the original 7a0.
- **Explicitly rejected:** FIFA-style live match simulation; client-authoritative competitive outcomes; animated 2D/3D match views.

See **[README.md](./README.md)** for layout and commands; **[MVP.md](./MVP.md)** for build order.

---

## 2. Current game analysis

This section documents observed behaviour and the engine, recovered from the live client. It is the baseline the requirements build on.

### 2.1 Concept

World Cup history, **1950–2026**: ~**52 national teams**, **250 squads**, **5,729 players**. Each *(team, Cup)* pairing has its own squad and strength data.

### 2.2 Core loop — "Roll · Build · Simulate"

1. **Scenario roll** — a **national team** and a **Cup** (edition) are drawn once as the *(team, Cup)* pairing for the match.
2. **Build** — the player fills an **11-position starting XI** with real players who actually represented that drawn team in that Cup. Each slot receives a **slot roll** (a batch of eligible candidates); the player may **reroll** that batch per position (including a limited **emergency reroll**).
3. **Simulate** — a **tournament campaign** runs; the goal is to win **7–0**, stay **unbeaten**, become **champion** and unlock **badges**.

### 2.3 Campaign structure (solo)


| Phase        | Type      | Opponent overall |
| ------------ | --------- | ---------------- |
| Group stage  | 3 matches | 68, 72, 76       |
| Round of 16  | knockout  | 79               |
| Quarterfinal | knockout  | 83               |
| Semifinal    | knockout  | 87               |
| Final        | knockout  | 91               |


### 2.4 Match engine (the numbers)

- **Expected goals (λ)** per team: `λ = clamp(baseLambda + (attack − opponentDefense) × slope, minLambda, maxLambda)` with `baseLambda = 1.4`, `slope = 0.08`, `minLambda = 0.15`, `maxLambda = 5`.
- **Goals scored** are sampled from a **Poisson(λ)** distribution (Knuth's algorithm).
- **Draws in knockouts** resolve via a **penalty model** (base probability 0.5, adjusted by strength difference, clamped to [0.1, 0.9]).
- Each team has an **overall** and a **band** (strength range). Badges such as *esmagador* depend on goal margins (e.g., goal difference ≥ 18 over a campaign).

### 2.5 Randomness & sharing

A **seeded RNG** (mulberry32) makes every match **deterministic and reproducible**: from a *seed/code*, two users obtain the exact same draw and simulation. This underpins the current "play with friends" features and shareable results.

> **Critical implication:** because simulation is currently **client-side and seed-deterministic**, any competitive mode requires **server authority** over the draw and the simulation, otherwise results are trivially manipulable.

### 2.6 Existing `/multi` modes

All are **local / code-based** (no real-time networking):

- **Local** — two players on the **same device**, alternating.
- **Cup Final** — each builds a team and they play the Final directly.
- **Knockout** — a **bracket of 4 to 16** entrants, mixing humans and CPU.
There is a "**Join with code**" option that shares the scenario (seed), but the experience remains comparison-based, not a connected live match.

### 2.7 Observed tech stack

- **Next.js** (App Router), game rendered client-side.
- **Auth** via *better-auth* (sessions synced across tabs via BroadcastChannel).
- **API routes**: `/api/auth`, `/api/match/record`, `/api/metric`, `/api/shorten`, `/api/geo`.
- **i18n**: PT / EN / ES. A **profile** page already exists.
- **No** real-time infrastructure (WebSocket / WebRTC / DB realtime) exists in the client today.

---

## 3. Problem & opportunity

**Problem.** The social experience is limited to sharing a result or playing on the same screen. There is no live head-to-head tension and no competitive progression to drive return visits. The "Simulate" step is also a single fidelity (instant text), leaving the drama of a match on the table.

**Opportunity.** "Build your dream team" is inherently competitive and shareable. A readable text simulation plus a real-time online mode with ranking and rematches can lift **retention (D7/D30)**, **sessions per user** and **virality**, while reusing most of the existing engine.

---

## 4. Goals & success metrics

### 4.1 Goals

- Make matches **readable** at two speeds without changing outcomes.
- Enable **real-time 1v1 online** between devices with **competitive integrity**.
- Add **progression** (ELO/ranking, online history).

### 4.2 Metrics (targets to calibrate)


| Metric                      | Definition                                       | Initial target |
| --------------------------- | ------------------------------------------------ | -------------- |
| Online conversion           | % of active players who play ≥1 online match     | ≥ 20%          |
| Match completion            | % of online matches finished without abandonment | ≥ 85%          |
| Sync latency (p95)          | action → opponent update                         | < 400 ms       |
| Matchmaking time (p50)      | enter room / find opponent                       | < 20 s         |
| Rematch rate                | % of matches followed by "play again"            | ≥ 30%          |
| Fast-mode adoption          | % of solo sims read as text ticker               | ≥ 40%          |


---

## 5. Personas

- **The Competitor** — wants ELO, rankings, rematches; values fairness and stats.
- **The Social Player** — wants to play friends via invite/code; values speed and easy rematch.
- **The Nostalgic/Casual** — loves the historical theme; needs simple onboarding and short matches.
- **The Low-end User** — older/weaker PC or mobile; needs the text tiers to be first-class, not afterthoughts.

---

## 6. Scope

### 6.1 In scope (v1)

- Two **speed tiers**: Fast (text play-by-play), Ultra Fast (instant).
- **Event timeline** generator feeding both tiers.
- **Online 1v1 Duel** (real-time, server-authoritative) with rooms/codes and rematch.
- **ELO/ranking**, leaderboard, online match history.
- Reconnection, timeout/AFK handling, anti-cheat.

### 6.2 Out of scope (v1)

- Real ball physics / player AI (we never simulate live — see §8.1).
- Free-text chat (use predefined **emotes** instead).
- Leagues/seasons, scheduled tournaments, spectators.
- Native apps / cross-play (product is web).
- Monetisation (keep Ko-fi support).

---

## 7. Match simulation & presentation (DETAILED)

### 7.1 Core principle — result first, three layers

The system is split into **three layers**:

```
ENGINE  →  TIMELINE  →  PRESENTATION
(numbers)  (events)     (text / Ultra Fast)
```

1. **Engine** — the existing Poisson model decides the **final result** (and, for knockouts, penalties). Pure numbers, no rendering.
2. **Timeline** — a deterministic function turns the result + seed into an **ordered list of match events** (kickoff, possession sequences, shots, goals, corners, penalties, full-time). This is the heart of the feature.
3. **Presentation** — consumers render the timeline as **minute-by-minute text** (Fast) or **instant result** (Ultra Fast).

This is **not FIFA** (no real-time physics/AI deciding outcomes) and **not the Football Manager engine** (which *simulates to produce* a result). In 7a0 the **result already exists**; what we build is a **scripted text replay of a pre-decided result**.

**Benefits:** outcomes never drift (the timeline is generated *from* the score, so it always reconciles); the two speed tiers are just different consumers of the same data; online integrity is preserved (the server owns the engine + timeline).

### 7.2 The match engine (reference)

Reuse the current model unchanged so the *feel* matches solo:

```
λ_team = clamp(1.4 + (attack − opponentDefense) × 0.08, 0.15, 5)
goalsScored ~ Poisson(λ_team)              // Knuth sampler
penaltyWin  = clamp(0.5 + Δstrength × 0.012, 0.1, 0.9)   // knockout draws
```

In online and in the new tiers, this **same engine** runs on the **server** with a server-generated seed.

### 7.3 The event timeline (format & generation)

The timeline is a deterministic, serialisable artifact. Suggested schema:

```ts
type Vec2 = { x: number; y: number };            // pitch coords, 0..1 normalised (x = length, y = width)

type MatchEvent =
  | { t: number; type: 'kickoff'; team: Side }
  | { t: number; type: 'possession'; team: Side; passes: PassHop[] }
  | { t: number; type: 'shot'; team: Side; from: Vec2; outcome: 'goal'|'saved'|'off'|'post' }
  | { t: number; type: 'goal'; team: Side; scorerId: string; assistId?: string; from: Vec2 }
  | { t: number; type: 'corner'; team: Side; side: 'L'|'R' }
  | { t: number; type: 'freekick'; team: Side; from: Vec2 }
  | { t: number; type: 'penalty'; team: Side; outcome: 'goal'|'miss'|'saved' }
  | { t: number; type: 'fulltime'; score: [number, number] }
  | { t: number; type: 'shootout'; kicks: ShootoutKick[]; winner: Side };

type PassHop = { fromId: string; toId: string; ball: Vec2 }; // ball = receiver location
type Side = 'home' | 'away';

interface MatchTimeline {
  seed: string;                 // server-owned
  scenario: { team: string; cup: number };
  lineups: Record<Side, LineupSlot[]>;   // 11 slots each, with shirt numbers + positions
  result: { score: [number, number]; penalties?: [number, number] };
  events: MatchEvent[];         // ordered by t (match minute, 0..90/120)
  durationMs: number;           // playback length at Fast ticker speed
}
```

**Generation rules (data only, no rendering):**

1. Place the known **goals** at minutes (reuse the engine's existing minute distribution; spread to avoid clustering).
2. Around and between goals, insert **filler events** whose *frequency loosely correlates to dominance* (`λ` gap): more shots/corners for the stronger side. These are cosmetic and never change the score.
3. Each **possession** event is a short chain of `PassHop`s between the lineup's slot positions (formation anchors), ending in a shot or a turnover.
4. **Set pieces**: occasional corners/free kicks; **penalties** are rare and only fire where the engine allows (e.g., one of the goals may be flagged as a penalty).
5. The **final event** is `fulltime` (and `shootout` if a knockout draw went to penalties), guaranteeing reconciliation with the engine result.
6. Everything is seeded → identical across clients and reproducible for **replays/highlights**.

> Start simple (goals + a few cosmetic events) and enrich the generator over time. Because it is decoupled from presentation, enriching it never touches the text consumers.

### 7.4 Speed tiers

Both consume the **same `MatchTimeline`**; they differ only in how/when events surface:


| Tier           | What the player sees                                                                                                                               | How it reads the timeline                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Fast**       | **Minute-by-minute text** commentary (key events appear in sequence) — the "live ticker". Play/pause, restart, skip-to-result.                   | Prints each event as text as the clock passes it.                                |
| **Ultra Fast** | **Instant final result** (scoreline + badges), exactly like today's 7a0 "Simulate".                                                                | Jumps straight to `fulltime`.                                                    |


Requirements:

- **RF-S1.** A persistent **speed setting** (Fast/Ultra) the player can change and that is remembered.
- **RF-S2.** In Fast, **play/pause**, **restart**, and **skip-to-result** controls are always available.
- **RF-S3.** Fast mode is fully usable with a screen reader (text-first → also the **accessibility** path).
- **RF-S4.** Switching tiers mid-match is allowed and must not change the outcome.

---

## 8. Text presentation (DETAILED)

### 8.1 Fast text consumer

- Reads the canonical `MatchTimeline` and emits ordered commentary lines via `toFastText`.
- One line per key event (kickoff, possession, shots, goals, corners, penalties, full-time).
- Ticker UI reveals lines over time; user controls play/pause, restart, skip.
- Same consumer powers CLI (`pnpm sim`), the Next.js demo app, and the screen-reader path.

### 8.2 Ultra Fast

- Shows final scoreline + badges immediately — original 7a0 behaviour.
- No timeline playback; jumps to `fulltime`.

### 8.3 Shareable highlights

- Highlight links replay **goal events only** as text commentary (filtered from the same timeline).
- Seed + lineups + tactics encoded in the URL; shortened via `/api/shorten`.
- Open Graph share card for link previews.

---

## 9. Online mode (DETAILED)

> **Implementation note:** the **8-player World Cup tournament** (§9.2 item 3,
> originally scoped as post-MVP "Online Knockout") shipped early in MVP M4 —
> see `MVP.md` §4.2 for the as-built flow. It replaces the room-by-code 1v1
> Duel described below (§9.2 item 1, §9.3, §9.4 RF-O1/RF-O2) with an untimed
> solo draft → shared pool → instant batch resolution of 2 round-robin
> groups → semis → final, with CPU bot-fill (real historical squads) on a
> stalled pool. ELO/ranking (§9.9), the room/code lobby model (§9.3-9.4), and
> "Online Final" (§9.2 item 2) remain unimplemented/post-MVP as described
> below — MVP.md wins where the two disagree.

### 9.1 Principle — server authority (non-negotiable)

Because the engine is seed-deterministic and currently client-side, **the server must own the draw, the seed, the engine run and the timeline**. The client only **presents** a result it receives. This is the foundation of competitive integrity and a prerequisite (Phase 0) for everything else online.

### 9.2 Online formats

1. **Online Duel (1v1)** — superseded by item 3 (the World Cup tournament) as MVP's shipped online mode; kept here as the original v1 spec for reference. Both players receive the **same scenario**, build their XI within a timer, and play a **head-to-head** match the server simulates.
2. **Online Final** — fast variant: skip straight to building the XI and the Final, 1v1. Not implemented.
3. **Online Knockout** — a **bracket of 4–16** seats mixing **humans and CPU**, with synchronised rounds. **Implemented in MVP M4** as the 8-player World Cup tournament (untimed draft, instant batch resolution, no synchronised rounds — see `MVP.md` §4.2).

### 9.3 Match state machine

```
LOBBY → DRAW → BUILD (timer) → READY → SIMULATE (server) → REVEAL → RESULT → (REMATCH → DRAW | END)
        ⟵⟵⟵ RECONNECT / TIMEOUT / ABANDON handled in any state ⟶⟶⟶
```

- **DRAW:** server picks scenario + seed (authoritative) and broadcasts to all seats.
- **BUILD:** synchronised timer; rerolls validated server-side (limits + consistent state).
- **READY:** when all confirm or the timer expires; incomplete XIs filled by rule (see §9.8).
- **SIMULATE:** server runs the engine, generates the **canonical timeline**, persists it.
- **REVEAL:** all players see the **same result**, each at **their own speed tier** (Fast or Ultra Fast).
- **RESULT:** winner, side-by-side comparison, **rematch** button.

### 9.4 Lobby, codes, invites, matchmaking

- **RF-O1.** Create a **room** → short **code** + **invite link** (reuse `/api/shorten`).
- **RF-O2.** **Join** by code or link; lobby shows **presence** (connected / building / ready / disconnected).
- **RF-O3.** Host sets **mode**, **bracket size** (if applicable) and **rules** (build timer, win rule, ranked/unranked).
- **RF-O4.** *(v1.1)* **Quick matchmaking** by approximate ELO within a widening window.

### 9.5 Real-time architecture (proposed)

Leverage a managed real-time + serverless stack (**Convex**):

- **Real-time layer** — per-room state via **Convex queries** (reactive sync) + presence fields on `room_players` (connected / building / ready / disconnected). Room state is small and short-lived.
- **Authoritative simulation** — a **Convex mutation or action** receives confirmed lineups, generates the **official seed**, runs the engine, builds the timeline, and writes the **canonical, immutable payload**. The client only presents it.
- **Persistence (Convex database)** — rooms, participants, match state, timelines, results, ELO, history.
- **Auth** — existing *better-auth*, required for ranked play.
- **Reuse** — `/api/match/record` (results), `/api/metric` (telemetry), `/api/shorten` (invites).

```
Client A ─┐                          ┌─ Convex (queries + subscriptions) ─┐
          ├─ confirm lineup ─→  Convex mutation/action (engine + timeline, server seed) ──┤→ canonical timeline → both clients present
Client B ─┘                          └─ Convex tables (rooms, matches, results, ELO) ─┘
```

### 9.6 Decoupled presentation online

Because presentation is decoupled from result, the server sends **one canonical timeline** and **each player reads it at their own speed tier** (Fast or Ultra Fast) over the **same shared result**. Tier choice never affects fairness or outcome.

### 9.7 Anti-cheat controls

1. **Draw + seed server-only**; never accepted from the client.
2. **Eligibility validation**: every selected player must be valid for the drawn *(team, Cup)*.
3. **Reroll validation**: counts and state checked server-side.
4. **Result computed exclusively on the server**; the client receives an immutable payload to present.
5. **Rate limiting** and **serial-abandon detection**.

### 9.8 Reconnection, timeout, AFK, abandonment

- **RF-O5. Reconnect:** a dropped player can **rejoin** an in-progress match and recover state within a window (e.g., 60 s).
- **RF-O6. Timeout/AFK:** inactivity past the limit **auto-confirms** the current XI or yields **loss by abandonment**, depending on phase.
- **RF-O7. Incomplete XI at timer end:** **neutral auto-fill** or penalty (decision in Open Questions).
- **RF-O8. Abandonment:** opponent is not harmed — win awarded / CPU substitution in brackets.

### 9.9 Progression & social

- **RF-O9. ELO/ranking:** ranked matches update both players' ELO; private invites can be **unranked** (configurable).
- **RF-O10. Leaderboards:** global and (optional) friends-only.
- **RF-O11. Online history** in profile: opponent, mode, result, **match seed** (for replay).
- **RF-O12. Rematch:** same players/rules, **new draw**.
- **RF-O13. Emotes/reactions:** predefined set during the match (no free chat in v1).

---

## 10. Non-functional requirements

- **RNF-1. Server authority / anti-cheat** (see §9.1, §9.7).
- **RNF-2. Latency:** state sync p95 < 400 ms; result reveal perceived as simultaneous.
- **RNF-3. Scalability:** many concurrent rooms; per-room state is small; matches are short.
- **RNF-4. Availability:** graceful degradation — if real-time fails, finish asynchronously and still record the result.
- **RNF-5. Performance:** text/Ultra path always available on all devices; no GPU requirements.
- **RNF-6. Privacy/LGPD:** minimal data (id, display name, ELO, history); updated privacy policy covering multiplayer.
- **RNF-7. i18n:** all new UI in **PT/EN/ES**.
- **RNF-8. Accessibility & mobile-first:** Fast/text tier screen-reader friendly; flows playable on a phone.
- **RNF-9. Observability:** per-match metrics (duration, abandonment, latency, errors) via `/api/metric`.

---

## 11. Data model (sketch)


| Table             | Key fields                                                             |
| ----------------- | ---------------------------------------------------------------------- |
| `rooms`           | id, code, mode, bracket_size, status, host_id, rules(json), created_at |
| `room_players`    | room_id, user_id, seat, presence, ready, joined_at                     |
| `matches`         | id, room_id, phase, seed (server), scenario(team,cup), status          |
| `match_lineups`   | match_id, user_id, lineup(json), confirmed_at                          |
| `match_timelines` | match_id, timeline(json), duration_ms                                  |
| `match_results`   | match_id, user_id, gf, ga, goals(json), badges(json), outcome          |
| `ratings`         | user_id, elo, wins, losses, updated_at                                 |


---

## 12. Edge cases & error handling


| Case                             | Handling                                                    |
| -------------------------------- | ----------------------------------------------------------- |
| Drop during BUILD                | Reconnect within window; on expiry, auto-confirm current XI |
| Drop during REVEAL               | Result already canonical on server; re-deliver on reconnect |
| Incomplete XI at timer end       | Neutral auto-fill or penalty (Open Questions)               |
| Tie on win rule                  | Penalties / tie-break rule by config (Open Questions)       |
| Empty bracket seat               | CPU takes the seat                                          |
| Ineligible player attempted      | Server rejection + forced correction                        |
| Abandoned/idle room              | Auto-expire and clean up                                    |


---

## 13. Phasing / roadmap

**Phase 0 — Foundations (server authority).** Move draw + engine + timeline generation server-side; persist the official seed/timeline. Prerequisite for online and for trustworthy replays.

**Phase 1 — Text presentation tiers.** Timeline generator + Fast text consumer + Ultra Fast instant. Play/pause/skip controls. Persistence of speed preference.

**Phase 2 — Online Duel (1v1).** Rooms/codes, synced build, server simulation, simultaneous reveal, rematch; basic ELO.

**Phase 3 — Progression & formats.** Leaderboards, online history, emotes; Online Final; Online Knockout (4–16, humans+CPU); quick matchmaking.

**Phase 4 (future).** Animated highlights (video/GIF), leagues/seasons, spectators, scheduled tournaments.

---

## 14. Risks & mitigation


| Risk                               | Impact | Mitigation                                                          |
| ---------------------------------- | ------ | ------------------------------------------------------------------- |
| Cheating (client-side RNG)         | High   | Full server authority (Phase 0 first)                               |
| Animation drifting from result     | Med    | Timeline generated *from* the score → always reconciles             |
| Sync/latency                       | Med    | Managed realtime; small room state; reveal from precomputed payload |
| Frequent abandonment               | Med    | CPU substitution, ELO penalty, easy rematch                         |
| Matchmaking liquidity (few online) | Med    | Prioritise code/invite rooms; CPU fill in brackets                  |
| Bracket sync complexity            | Med    | Defer to Phase 4; start with 1v1                                    |


---

## 15. Open questions (decisions to make)

1. **1v1 win rule:** both play the **same scenario** and compare result/margin, **or** the two XIs **face each other** in one match? (Recommendation: direct head-to-head — most intuitive as a "duel".)
2. **Tie-break:** penalties, higher band, or sudden-death new draw?
3. **Incomplete XI at timer end:** neutral auto-fill vs penalty.
4. **Ranked vs friendly:** do private invites count toward ELO?
5. **Build timer** length (e.g., 60–120 s) — calibrate via testing.
6. **Shared vs distinct scenarios** in 1v1: shared is fairest but reduces variety; consider distinct seeds + strength handicap.

---

## 16. Appendix

### 16.1 Engine constants (reference)

```
Campaign opponent overall by phase:
  Group: 68, 72, 76 · R16: 79 · QF: 83 · SF: 87 · Final: 91

Goal model:
  λ = clamp(1.4 + (attack − opponentDefense) × 0.08, 0.15, 5)
  goals ~ Poisson(λ)            // Knuth's algorithm

Penalties (knockout draw):
  prob = clamp(0.5 + Δstrength × 0.012, 0.1, 0.9)

Badges (example): esmagador → goal difference ≥ 18
RNG: mulberry32 with seed (deterministic / shareable)
```

### 16.2 Why this is tractable (summary)

- One **engine** decides the numbers.
- One **timeline** dramatises those numbers (and powers Fast text + replays/highlights).
- **Text presentation** (Fast ticker + Ultra Fast instant) consumes the same timeline.
- The **server** owns engine + timeline, so **online** is fair by construction and each player can read at their own speed tier over the **same** result.


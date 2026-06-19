## 1. MVP goal

Ship the **smallest version worth launching**: a readable **text simulation** (like the original 7a0), a real **online** duel, and the features that make building a team feel meaningful and social — **shareable highlights, match statistics, squad chemistry, tactical choice, and a daily challenge**. Everything else from the full PRD is deferred.

---

## 2. Scope

### 2.1 In scope (MVP)

1. **Simulation** — the existing Poisson engine + an **event timeline** + two speed tiers (Fast text, Ultra Fast instant). Reused everywhere.
2. **Text presentation only** — minute-by-minute ticker (Fast) and instant result (Ultra Fast); no animated match view.
3. **Online (1v1 Duel)** — server-authoritative, room by **code**, synced build, simultaneous reveal, rematch.
4. **Shareable highlights** — a link that **replays the goals** as text commentary (seed + lineups + tactics encoded; shortened via `/api/shorten`).
5. **Match statistics** — possession, shots, on-target, corners, penalties, xG, passes.
6. **Squad chemistry** — a lineup bonus/penalty that nudges team strength.
7. **Tactical choice** — Offensive / Balanced / Defensive, biasing the goal model.
8. **Daily challenge** — one shared daily scenario; compare and share results.

### 2.2 Out of scope (post-MVP)

- **Animated match views** (2D, 3D, or video/GIF export of highlights).
- Online **matchmaking, ELO/ranking, leaderboards** (beyond the daily leaderboard), online **Final** and **Knockout brackets**.
- Emotes, leagues/seasons, spectators, native apps, monetisation.
- Advanced reconnection (basic only in MVP).

---

## 3. Architecture (MVP)

The same three-layer spine as the PRD:

```
ENGINE (numbers)  →  TIMELINE (events)  →  PRESENTATION (text / Ultra Fast)
```

- **Engine** decides the result (Poisson; unchanged) — **on the server** for online and daily challenge (server authority is mandatory there).
- **Timeline** is a deterministic, serialisable list of match events generated *from* the result + seed. It powers Fast text, the statistics, and the shareable highlight.
- **Presentation** in MVP = **text tiers only** (Fast ticker + Ultra Fast instant), integrated into the **existing Next.js app** — not a separate demo site in this repo.

**Not in scope:** live physics or player AI that decides goals during play. The result is fixed before any replay runs (same as today's Ultra Fast 7a0, extended with optional text replay).

Reuse existing routes: `/api/match/record` (results), `/api/shorten` (highlight/daily links), `/api/metric` (telemetry), `/api/auth` (online).

### 3.1 Implementation in this repository (`draft-world-cup`)

| Layer | Status | Code |
| ----- | ------ | ---- |
| Engine | ✅ M1 | `src/engine.ts`, `src/poisson.ts`, `src/rng.ts`, `src/constants.ts` |
| Timeline | ✅ M1 | `src/timeline/`, `src/types.ts` |
| Fast text | ✅ M1 | `src/consumers/fastText.ts`, `src/cli/simulate.ts` (`pnpm sim`) |
| Chemistry / tactics UI | ⏳ M2 | Engine API ready; Build screen in main app |
| Stats, online, highlights, daily | ⏳ M3–M6 | Specs below; not started in this package |

Public export (`src/index.ts`) = engine + timeline + Fast text only (server-safe bundle).

---

## 4. Feature specs

### 4.1 Simulation & speed tiers

- **Engine:** `λ = clamp(1.4 + (attack − opponentDefense) × 0.08, 0.15, 5)`, `goals ~ Poisson(λ)`; knockout draws via the penalty model. `attack`/`defense` are the team overall **after chemistry and tactics modifiers** (§4.5, §4.6).
- **Timeline:** generate goals at minutes (existing distribution), then insert cosmetic events (possession chains, shots, corners, the occasional penalty) whose frequency loosely tracks the λ gap. The final event reconciles to the exact score, so the text replay can never disagree with the result.
- **Tiers** (all read the same timeline):
  - **Fast** — minute-by-minute **text** ticker (also the screen-reader path); play/pause, restart, skip-to-result.
  - **Ultra Fast** — **instant** final score + badges (today's 7a0 behaviour).
- The speed tier is a **persisted preference**; switching mid-match never changes the outcome.

### 4.2 Online (1v1 Duel)

- **Server authority (mandatory):** the **server** picks scenario + seed, validates lineups, runs the engine, builds the canonical timeline. The client only presents the result. No client-decided outcomes.
- **Flow / state machine:** 
  ```
  LOBBY → DRAW → BUILD (timer) → READY → SIMULATE (server) → REVEAL → RESULT → (REMATCH → DRAW | END)

  ```
- **Rooms:** create → short **code** + **invite link**; join by code/link; lobby shows **presence** (connected / building / ready / disconnected).
- **DRAW (scenario roll):** server picks one *(team, Cup)* + seed; both players build from eligible squads for that scenario (online duel) or each receives their own scenario (solo).
- **Build:** synchronised timer; **slot rolls and rerolls validated server-side**; incomplete XI at timer end → neutral auto-fill (MVP rule).
- **Reveal:** both players see the **same** canonical result; each may read it in Fast or Ultra Fast.
- **Result:** winner + side-by-side comparison + **rematch** (new draw, same players).
- **Win rule (MVP default):** the two XIs **face each other head-to-head** in a single match (recommended as the most intuitive "duel"); tie → penalties.
- **Robustness (MVP-level):** basic **reconnect** to an in-progress match within a short window; **AFK/abandon** → opponent awarded the win. (No ELO in MVP.)
- **Realtime:** managed channel for broadcast + presence (e.g., Supabase Realtime); authoritative sim in a server/Edge Function; Postgres for rooms/matches/results.

### 4.3 Shareable highlights

- A highlight is a **link** that, when opened, **replays the goals** as text commentary (seed + lineups + tactics encoded; shortened via `/api/shorten`).
- Includes a simple **share card**: scoreline, team/Cup, and badges (Open Graph image so links preview nicely).
- Viewer reads the goals in **Fast text** or sees the **instant result** in Ultra Fast; **no login required** to view.

### 4.4 Match statistics

Derived from the timeline + engine, shown post-match:

- **Possession %**, **shots**, **shots on target**, **corners**, **penalties**, **passes**, and an approximate **xG** (from per-shot λ contributions).
- Side-by-side for both teams; used in the result screen and in online comparison.

### 4.5 Squad chemistry

A lineup quality signal that **nudges team strength** (feeds `attack`/`defense` in the engine):

- **Position fit:** each of the 11 in their **natural position** gives full value; out of position gives reduced value (full credit for exact role, partial for adjacent roles, low for unrelated).
- **Chemistry % = weighted share of well-placed players** (0–100).
- **Chemistry bonus to overall** = `round((chem% − 50) / 100 × 6)` → roughly **−3 … +3** points, applied to attack and defense.
- Shown in Build as a live meter, so players are rewarded for thoughtful XI placement.
- *(All 11 already come from the same team/Cup by eligibility, so MVP chemistry is mainly about correct placement; era/synergy bonuses can be added later.)*

### 4.5.1 Roll mechanics (scenario vs slot)

- **Scenario roll** — once per match: draw *(national team, Cup)*. Defines the squad pool for Build.
- **Slot roll** — per XI position: draw a batch of eligible candidates from that scenario's squad.
- **Reroll** — refresh one slot's candidate batch (limited per slot; server-validated online).
- **Emergency reroll** — separate, smaller limit for one tight spot.
- All rolls are **seed-deterministic** (`mulberry32`); the server owns the seed for online/daily.

### 4.5.2 Player force and derived team strength

- Each player in a squad has one **`force`** (0–255), stored in the catalog (autoral or imported).
- **Attack / defense / overall** are **not** stored per scenario — they are derived from the **11 chosen players** via position-weighted averages (live 7a0 model), then chemistry and tactics apply via `effectiveStrength`.
- Full squad (~23 players) is eligible for roll/build; only the selected XI feeds the engine.
- Import: `pnpm import:squads --dir ./squads --out ./data/catalog.json` (live `{ sel, copa, squad, f }` or autoral export). Server stores forces in clear text.

### 4.6 Tactical choice

A single pre-match choice that **biases the goal model** (a real trade-off, useful for chasing a 7–0 vs protecting a lead):


| Tactic        | Effect (on effective ratings, δ ≈ 4)                          |
| ------------- | ------------------------------------------------------------- |
| **Offensive** | attack **+δ**, your defense **−δ** → score more, concede more |
| **Balanced**  | no change                                                     |
| **Defensive** | attack **−δ**, your defense **+δ** → score less, concede less |


- δ is tunable; applied before computing λ for both teams.
- One choice per match (per phase, in a campaign). Visible in stats and in the highlight card.

### 4.7 Daily challenge

- A **deterministic daily seed** (from the UTC date) gives **everyone the same scenario** (team + Cup) for the day.
- **One official attempt** per day counts for the day's comparison; free practice after.
- A simple **daily leaderboard** (best result / margin) using `/api/match/record`; results are **shareable** via the highlight link.
- Server-authoritative (same anti-cheat as online) so the daily comparison is fair.

---

## 5. Data model (MVP subset)


| Table             | Key fields                                                                    |
| ----------------- | ----------------------------------------------------------------------------- |
| `rooms`           | id, code, status, host_id, rules(json), created_at                            |
| `room_players`    | room_id, user_id, presence, ready, joined_at                                  |
| `matches`         | id, room_id?, kind('online'|'daily'|'solo'), seed, scenario(team,cup), status |
| `match_lineups`   | match_id, user_id, lineup(json), tactic, chemistry_pct, confirmed_at          |
| `match_timelines` | match_id, timeline(json), duration_ms                                         |
| `match_results`   | match_id, user_id, gf, ga, stats(json), badges(json), outcome                 |
| `daily`           | date, seed, scenario(team,cup)                                                |


---

## 6. Build order (milestones)

1. ~~**M1 — Server-authoritative engine + timeline generator** (pure functions; verify via `pnpm sim` / Fast text). *Foundation for online + daily.*~~ ✅
2. **M2 — Chemistry + Tactics** wired into the engine and surfaced in Build (live chemistry meter, tactic picker).
3. **M3 — Match statistics** screen (derived from timeline).
4. **M4 — Online 1v1 Duel** (rooms by code, synced build, server sim, reveal, rematch, basic reconnect/AFK).
5. **M5 — Shareable highlights** (text goal replay link + share card).
6. **M6 — Daily challenge** (daily seed, one attempt, simple leaderboard, share).

---

## 7. Definition of done (acceptance)

- A solo match can be read in **Fast** or resolved in **Ultra Fast**, all from one timeline, with **skip** working in Fast.
- **Chemistry** and **tactics** measurably change λ and the result, and are visible in Build and stats.
- Two players on **different devices** complete an **online duel** by code, see the **same** result simultaneously, and can **rematch**; outcome is **server-decided**.
- A finished match produces a **working highlight link** (replays goals as text, previews with a share card) and a **stats** breakdown.
- The **daily challenge** gives everyone the same scenario and records a comparable result.
- **Fast text** and **Ultra Fast** are always available on all devices.

---

## 8. Success metrics (MVP)


| Metric                                          | Target   |
| ----------------------------------------------- | -------- |
| Online duel completion (no abandon)             | ≥ 85%    |
| Fast-mode adoption (matches read as ticker)     | ≥ 40%    |
| Highlight share rate (matches → links created)  | ≥ 15%    |
| Daily challenge participation (DAU who play it) | ≥ 25%    |
| Sync latency (p95)                              | < 400 ms |


---

## 9. Open decisions (MVP)

1. **Online win rule:** head-to-head (recommended) vs same-scenario comparison.
2. **Tie-break:** penalties (recommended) vs higher band.
3. **Incomplete XI at timer end:** neutral auto-fill (recommended) vs penalty.
4. **Tactic δ** value and **chemistry range** (±3) — calibrate via playtests.
5. **Daily attempts:** strictly one official attempt vs best-of-N.
6. **Build timer** length (≈ 60–120 s).

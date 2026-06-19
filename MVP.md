## 1. MVP goal

Ship the **smallest version worth launching**: a watchable **2D** match, a real **online** duel, and the features that make building a team feel meaningful and social — **shareable highlights, match statistics, squad chemistry, tactical choice, and a daily challenge**. Everything else from the full PRD is deferred.

---

## 2. Scope

### 2.1 In scope (MVP)

1. **Simulation** — the existing Poisson engine + an **event timeline** + three speed tiers (Normal animated, Fast text, Ultra Fast instant). Reused everywhere.
2. **2D rendering only** — top-down **2D** animated match (no 3D in MVP).
3. **Online (1v1 Duel)** — server-authoritative, room by **code**, synced build, simultaneous reveal, rematch.
4. **Shareable highlights** — a link that replays the match's goals in the 2D view.
5. **Match statistics** — possession, shots, on-target, corners, penalties, xG, passes.
6. **Squad chemistry** — a lineup bonus/penalty that nudges team strength.
7. **Tactical choice** — Offensive / Balanced / Defensive, biasing the goal model.
8. **Daily challenge** — one shared daily scenario; compare and share results.

### 2.2 Out of scope (post-MVP)

- **3D** grass renderer (planned next).
- Online **matchmaking, ELO/ranking, leaderboards** (beyond the daily leaderboard), online **Final** and **Knockout brackets**.
- **GIF/video** export of highlights (link-based replay only in MVP).
- Emotes, leagues/seasons, spectators, native apps, monetisation.
- Advanced reconnection (basic only in MVP).

---

## 3. Architecture (MVP)

The same three-layer spine as the PRD:

```
ENGINE (numbers)  →  TIMELINE (events)  →  PRESENTATION (text / 2D)
```

- **Engine** decides the result (Poisson; unchanged) — **on the server** for online and daily challenge (server authority is mandatory there).
- **Timeline** is a deterministic, serialisable list of match events generated *from* the result + seed. It powers Fast text, the 2D animation, the statistics, and the shareable highlight.
- **Presentation** in MVP = **2D top-down renderer** (Canvas/Pixi) + **text** tiers, integrated into the **existing Next.js app** — not a separate demo site in this repo.

**Not in scope:** live physics or player AI that decides goals during play. The result is fixed before any animation runs (same as today's Ultra Fast 7a0, extended with optional replay tiers).

Reuse existing routes: `/api/match/record` (results), `/api/shorten` (highlight/daily links), `/api/metric` (telemetry), `/api/auth` (online).

### 3.1 Implementation in this repository (`draft-world-cup`)

| Layer | Status | Code |
| ----- | ------ | ---- |
| Engine | ✅ M1 | `src/engine.ts`, `src/poisson.ts`, `src/rng.ts`, `src/constants.ts` |
| Timeline | ✅ M1 | `src/timeline/`, `src/types.ts` |
| Fast text | ✅ M1 | `src/consumers/fastText.ts`, `src/cli/simulate.ts` (`pnpm sim`) |
| 2D render | 🔶 M2 library | `src/render/` — wire into Next.js; verified by unit tests, **no local browser demo** |
| Chemistry / tactics UI | ⏳ M3 | Engine API ready; Build screen in main app |
| Stats, online, highlights, daily | ⏳ M4–M7 | Specs below; not started in this package |

Public export (`src/index.ts`) = engine + timeline + Fast text only (server-safe bundle).

---

## 4. Feature specs

### 4.1 Simulation & speed tiers

- **Engine:** `λ = clamp(1.4 + (attack − opponentDefense) × 0.08, 0.15, 5)`, `goals ~ Poisson(λ)`; knockout draws via the penalty model. `attack`/`defense` are the team overall **after chemistry and tactics modifiers** (§4.6, §4.7).
- **Timeline:** generate goals at minutes (existing distribution), then insert cosmetic events (possession chains, shots, corners, the occasional penalty) whose frequency loosely tracks the λ gap. The final event reconciles to the exact score, so the animation can never disagree with the result.
- **Tiers** (all read the same timeline):
  - **Normal** — animated 2D match; clock compresses ~90 min into ~60–90 s; **skip-to-result** and **1×/2×** always available.
  - **Fast** — minute-by-minute **text** ticker (also the screen-reader path).
  - **Ultra Fast** — **instant** final score + badges (today's 7a0 behaviour).
- The speed tier is a **persisted preference**; switching mid-match never changes the outcome.

### 4.2 2D renderer (top-down)

- **Tech:** Canvas 2D or Pixi.js; `requestAnimationFrame` loop interpolating positions by match time.
- **Pitch:** top-down, normalised coordinates `(x, y)` in `0..1`.
- **Tokens:** small circles in team colour with the **shirt number** centered; the **ball-carrier** has a thicker ring; the **ball** is a small white circle.
- **Movement (puppet-show, no physics/AI):** players sit at formation anchors + a small **ball-relative block shift** (attacking side pushes up, defending drops) + gentle idle noise. Ball moves by **lerp** (passes) / **Bézier** (crosses, corners, shots).
- **Choreographies:** goal celebration, penalty mini-scene, corner delivery — small pre-authored sequences triggered by timeline events.
- **Performance floor:** ≥ 50 fps on weak PCs; if even 2D struggles, offer Ultra Fast/text.

### 4.3 Online (1v1 Duel)

- **Server authority (mandatory):** the **server** picks scenario + seed, validates lineups, runs the engine, builds the canonical timeline. The client only animates the result. No client-decided outcomes.
- **Flow / state machine:** 
  ```
  LOBBY → DRAW → BUILD (timer) → READY → SIMULATE (server) → REVEAL → RESULT → (REMATCH → DRAW | END)

  ```
- **Rooms:** create → short **code** + **invite link**; join by code/link; lobby shows **presence** (connected / building / ready / disconnected).
- **Build:** synchronised timer; **rerolls validated server-side**; incomplete XI at timer end → neutral auto-fill (MVP rule).
- **Reveal:** both players watch the **same** canonical result; each may watch in their own tier (2D or text).
- **Result:** winner + side-by-side comparison + **rematch** (new draw, same players).
- **Win rule (MVP default):** the two XIs **face each other head-to-head** in a single match (recommended as the most intuitive "duel"); tie → penalties.
- **Robustness (MVP-level):** basic **reconnect** to an in-progress match within a short window; **AFK/abandon** → opponent awarded the win. (No ELO in MVP.)
- **Realtime:** managed channel for broadcast + presence (e.g., Supabase Realtime); authoritative sim in a server/Edge Function; Postgres for rooms/matches/results.

### 4.4 Shareable highlights

- A highlight is a **link** that, when opened, **replays the goals** of a match in the 2D view (seed + lineups + tactics encoded; shortened via `/api/shorten`).
- Includes a simple **share card**: scoreline, team/Cup, and badges (Open Graph image so links preview nicely).
- Viewer can watch the goals (Normal-2D) or read them (Fast text); **no login required** to view.
- *(Post-MVP: GIF/MP4 export.)*

### 4.5 Match statistics

Derived from the timeline + engine, shown post-match (and live in Normal):

- **Possession %**, **shots**, **shots on target**, **corners**, **penalties**, **passes**, and an approximate **xG** (from per-shot λ contributions).
- Side-by-side for both teams; used in the result screen and in online comparison.

### 4.6 Squad chemistry

A lineup quality signal that **nudges team strength** (feeds `attack`/`defense` in the engine):

- **Position fit:** each of the 11 in their **natural position** gives full value; out of position gives reduced value (full credit for exact role, partial for adjacent roles, low for unrelated).
- **Chemistry % = weighted share of well-placed players** (0–100).
- **Chemistry bonus to overall** = `round((chem% − 50) / 100 × 6)` → roughly **−3 … +3** points, applied to attack and defense.
- Shown in Build as a live meter, so players are rewarded for thoughtful XI placement.
- *(All 11 already come from the same team/Cup by eligibility, so MVP chemistry is mainly about correct placement; era/synergy bonuses can be added later.)*

### 4.7 Tactical choice

A single pre-match choice that **biases the goal model** (a real trade-off, useful for chasing a 7–0 vs protecting a lead):


| Tactic        | Effect (on effective ratings, δ ≈ 4)                          |
| ------------- | ------------------------------------------------------------- |
| **Offensive** | attack **+δ**, your defense **−δ** → score more, concede more |
| **Balanced**  | no change                                                     |
| **Defensive** | attack **−δ**, your defense **+δ** → score less, concede less |


- δ is tunable; applied before computing λ for both teams.
- One choice per match (per phase, in a campaign). Visible in stats and in the highlight card.

### 4.8 Daily challenge

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
2. **M2 — 2D top-down renderer** playing the timeline (Normal/Fast/Ultra), with skip + speed controls — **integrate into Next.js** (`src/render/` library exists in this repo).
3. **M3 — Chemistry + Tactics** wired into the engine and surfaced in Build (live chemistry meter, tactic picker).
4. **M4 — Match statistics** screen (derived from timeline).
5. **M5 — Online 1v1 Duel** (rooms by code, synced build, server sim, reveal, rematch, basic reconnect/AFK).
6. **M6 — Shareable highlights** (replay link + share card).
7. **M7 — Daily challenge** (daily seed, one attempt, simple leaderboard, share).

---

## 7. Definition of done (acceptance)

- A solo match can be watched in **2D Normal**, read in **Fast**, or resolved in **Ultra Fast**, all from one timeline, with **skip** working.
- **Chemistry** and **tactics** measurably change λ and the result, and are visible in Build and stats.
- Two players on **different devices** complete an **online duel** by code, see the **same** result simultaneously, and can **rematch**; outcome is **server-decided**.
- A finished match produces a **working highlight link** (replays goals, previews with a share card) and a **stats** breakdown.
- The **daily challenge** gives everyone the same scenario and records a comparable result.
- **2D ≥ 50 fps** on a weak PC; **Ultra Fast/text** always available as fallback.

---

## 8. Success metrics (MVP)


| Metric                                          | Target   |
| ----------------------------------------------- | -------- |
| Online duel completion (no abandon)             | ≥ 85%    |
| Normal-mode adoption (matches watched animated) | ≥ 40%    |
| Highlight share rate (matches → links created)  | ≥ 15%    |
| Daily challenge participation (DAU who play it) | ≥ 25%    |
| 2D frame rate on low-end                        | ≥ 50 fps |
| Sync latency (p95)                              | < 400 ms |


---

## 9. Open decisions (MVP)

1. **Online win rule:** head-to-head (recommended) vs same-scenario comparison.
2. **Tie-break:** penalties (recommended) vs higher band.
3. **Incomplete XI at timer end:** neutral auto-fill (recommended) vs penalty.
4. **Tactic δ** value and **chemistry range** (±3) — calibrate via playtests.
5. **Daily attempts:** strictly one official attempt vs best-of-N.
6. **Build timer** length (≈ 60–120 s).


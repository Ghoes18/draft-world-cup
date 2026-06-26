## 1. MVP goal

Ship the **smallest version worth launching**: a readable **text simulation** (like the original 7a0), a real **online** duel, and the features that make building a team feel meaningful and social — **shareable highlights, match statistics, squad chemistry, tactical choice, and a missions + weekly-boss layer**. Everything else from the full PRD is deferred.

---

## 2. Scope

### 2.1 In scope (MVP)

1. ✅ **Simulation** — the existing Poisson engine + an **event timeline** + two speed tiers (Fast text, Ultra Fast instant). Reused everywhere. *(M1)*
2. ✅ **Text presentation only** — minute-by-minute ticker (Fast) and instant result (Ultra Fast); no animated match view. *(M1 — `apps/web`)*
3. ✅ **Online (World Cup Tournament)** — server-authoritative, untimed solo draft → join a pool of 8 → the moment the pool fills (or a stalled pool times out and is topped up with CPU bots drafted from real historical squads), the server resolves 2 round-robin groups → semifinals → final in one mutation. *(M4 — Convex backend + `/duel` UI)*
4. ✅ **Shareable highlights** — a link that **replays the goals** as text commentary (self-contained payload encoded in the URL; no login or catalog needed to view). *(M5)*
5. ✅ **Match statistics** — possession, shots, on-target, corners, penalties, xG, passes. *(M3)*
6. ✅ **Squad chemistry** — a lineup bonus/penalty that nudges team strength. *(M2)*
7. ✅ **Tactical choice** — Offensive / Balanced / Defensive, biasing the goal model. *(M2)*
8. ✅ **Missions & Weekly Boss** — daily + career objectives completed through any match, plus a weekly Boss squad with one attempt per day. Server-authoritative. *(M6)*

### 2.2 Out of scope (post-MVP)

- **Animated match views** (2D, 3D, or video/GIF export of highlights).
- **ELO/ranking, persistent leaderboards** (beyond the daily leaderboard), seeded/skill-based matchmaking. *(The 8-player World Cup tournament — random pool, group stage → semis → final — shipped ahead of schedule in M4; only ranked matchmaking remains deferred.)*
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
| Chemistry + tactics | ✅ M2 | `src/chemistry.ts`, `src/strength.ts`; Build panel + formation picker in `apps/web` |
| Match statistics | ✅ M3 | `src/consumers/stats.ts`; `StatsPanel` in `apps/web` |
| Online World Cup tournament | ✅ M4 | `apps/web/convex/tournament.ts`, `apps/web/app/duel/`; `src/online.ts` (replay validation + `resolveDuel`) |
| Shareable highlights | ✅ M5 | `src/highlight.ts` (codec + badges + commentary); `apps/web/app/h/[code]/` viewer + OG image; `ShareHighlight` in `ResultCard`/`TournamentReveal` |
| Missions & Weekly Boss | ✅ M6 | `src/period.ts`, `src/missions.ts`; `apps/web/convex/{missions,solo,boss}.ts`; `apps/web/app/missions/` |

Public export (`src/index.ts`) = engine + timeline + Fast text + stats + chemistry/tactics + online replay helpers + highlight codec (server-safe bundle).

---

## 4. Feature specs

### 4.1 Simulation & speed tiers

- **Engine:** `λ = clamp(1.4 + (attack − opponentDefense) × 0.08, 0.15, 5)`, `goals ~ Poisson(λ)`; knockout draws via the penalty model. `attack`/`defense` are the team overall **after chemistry and tactics modifiers** (§4.5, §4.6).
- **Timeline:** generate goals at minutes (existing distribution), then insert cosmetic events (possession chains, shots, corners, the occasional penalty) whose frequency loosely tracks the λ gap. The final event reconciles to the exact score, so the text replay can never disagree with the result.
- **Tiers** (all read the same timeline):
  - **Fast** — minute-by-minute **text** ticker (also the screen-reader path); play/pause, restart, skip-to-result.
  - **Ultra Fast** — **instant** final score + badges (today's 7a0 behaviour).
- The speed tier is a **persisted preference**; switching mid-match never changes the outcome.

### 4.2 Online (World Cup Tournament)

- **Server authority (mandatory):** the **server** owns every match seed, validates each player's submitted draft (action-log replay, same anti-cheat as solo), runs the engine, builds every canonical timeline. The client only presents what it reads back. No client-decided outcomes.
- **Flow / state machine:**
  ```
  BUILD (untimed, solo) → JOIN POOL → [pool fills to 8, or stalls and is bot-filled] →
  RESOLVE (server: groups → semis → final, one mutation) → REVEAL (bracket + standings) → (SEARCH AGAIN → BUILD)
  ```
- **Pool:** no rooms or codes — a player drafts solo and joins a shared pool. The instant the pool reaches **8 players**, the tournament resolves; while waiting, the client shows live "x / 8 players" fill progress.
- **Format:** **2 round-robin groups of 4** (6 fixtures each, 3/1/0 points, tiebreak by goal difference then goals scored) → top 2 per group advance → **semifinals** (cross-bracket: Group A 1st vs Group B 2nd, and vice versa) → **final**. No third-place playoff.
- **Resolution model:** **instant/batch** — all 15 fixtures (12 group + 2 semi + 1 final) are simulated and stored in one mutation the moment the pool is ready. No live timers, no per-match presence.
- **Draws:** group-stage fixtures allow a draw (`resolveDuel(..., knockout: false)`); semifinals and the final never do — a tie goes to penalties (`knockout: true`), same rule as solo knockout matches.
- **Stalled-pool handling:** if the pool doesn't fill within the timeout window, remaining seats are auto-filled with **CPU bots drafted from real historical squads already in the catalog** (e.g. Portugal 2006, Spain 2010 — not generic neutral-strength fillers), using the same `autoFillLineup` + scenario draft the solo campaign's CPU opponent already uses.
- **Reveal:** every player reactively sees the same group standings, their own group fixtures (each playable as a full Fast/Ultra Fast timeline), the bracket, and the champion — all derived from the one canonical resolution.
- **Result:** "Search again with a new squad" returns to a fresh, untimed draft and rejoins the pool. Tournaments are immutable history, not a rematchable room.
- **Realtime:** **Convex** reactive queries for pool fill progress and tournament state; the resolution itself runs in a **mutation** (`startTournament`, triggered by `joinQueue` or the scheduled bot-fill backstop `tryStartTournament`); Convex tables for `queue`/`tournaments`/`participants`/`matches`.

### 4.3 Shareable highlights

- A highlight is a **link** that, when opened, **replays the goals** as text commentary. The payload is **self-contained** (scenario, score, goals with scorer/assist names, shootout kicks) and base64url-encoded in the path (`/h/[code]`), so it reproduces exactly with no dependency on the catalog version and works for solo and online matches alike. Optionally shortenable via `/api/shorten` in the main app.
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

### 4.7 Missions & Weekly Boss

*(M6, as built — supersedes the original "daily challenge" sketch. The product
owner redefined this milestone into a Missions system plus a Weekly Boss; the
scenario-locked draft is unchanged and there is no separate "daily seed
scenario" or per-day leaderboard. Persistent ranking stays in online mode only.)*

**Missions** — objectives the player completes through **any** match they play:

- **Daily missions** rotate from a deterministic UTC-date seed (everyone sees
  the same set); **persistent missions** are always-on career/achievement goals.
- Categories: **composition** (e.g. "field 3+ Brazil players" — satisfied when
  you roll that nation), **result** (e.g. "win 7–0", "clean sheet", "beat the
  Boss"), and **career/cumulative** (e.g. "score 50 goals", "2 GOATs — field
  CR7 and Messi across matches", "field 5 different legends").
- Progress is **server-authoritative**: every counted match is re-validated
  (action-log replay) and re-resolved on the server, then folded into
  per-`playerId` `playerStats` + `missionProgress`. A tampered score earns no
  credit. A completed mission is never downgraded.

**Weekly Boss** — a real historical squad, drawn deterministically from the ISO
week (same for everyone Mon–Sun):

- A dedicated **"Challenge the Boss"** match: build an XI and face the fixed
  weekly Boss; server-authoritative, **one attempt per UTC day** (enforced via
  `bossAttempts` `by_player_date`), with your day result and best-of-week shown.
- A tie goes to penalties (`knockout: true`), same rule as online knockouts.
- Missions and the Boss are independent except for the `beat-boss` mission
  predicate, which only credits inside the Boss challenge.

Engine helpers live in `src/period.ts` (UTC/ISO-week keys + seeds) and
`src/missions.ts` (predicates, evaluator, daily selection — pure + tested).
Backend in `apps/web/convex/{missions,solo,boss}.ts` on the shared
`gameCatalog`. UI at `apps/web/app/missions/` (`MissionCard`, `BossCard`,
Boss build flow); solo matches report via `solo.recordMatch`.

---

## 5. Data model (MVP subset)


| Table             | Key fields                                                                    |
| ----------------- | ----------------------------------------------------------------------------- |
| `queue`           | player_id, name, seed, formation_id, tactic, actions(json), joined_at, last_seen, tournament_id? |
| `tournaments`      | id, seed, created_at, champion_slot                                          |
| `participants`     | tournament_id, slot(0-7), group_index(0/1), kind('human'|'cpu'), player_id?, name, scenario_id? |
| `matches`          | id, tournament_id, stage('group'|'semi'|'final'), group_index?, home_slot, away_slot, seed, timeline(json), gf, ga, winner_slot? |
| `bossAttempts`     | player_id, week_key, date_key, seed, formation_id, tactic, actions(json), timeline(json), gf, ga, beat, created_at |
| `missionProgress`  | player_id, mission_id, period_key, type('daily'|'persistent'), progress, target, status, completed_at? |
| `playerStats`      | player_id, total_goals, wins, clean_sheets, legend_ids[], nations[]            |


---

## 6. Build order (milestones)

1. ~~**M1 — Server-authoritative engine + timeline generator** (pure functions; verify via `pnpm sim` / Fast text). *Foundation for online + daily.*~~ ✅
2. ~~**M2 — Chemistry + Tactics** wired into the engine and surfaced in Build (live chemistry meter, tactic picker).~~ ✅
3. ~~**M3 — Match statistics** screen (derived from timeline).~~ ✅
4. **M4 — Online World Cup Tournament** (untimed solo draft, 8-player pool, instant batch resolution of 2 groups → semis → final, CPU bot-fill on a stalled pool). ✅ *Convex + `/duel` implemented.*
5. **M5 — Shareable highlights** (text goal replay link + share card). ✅ *`src/highlight.ts` codec + `/h/[code]` viewer with OG image; share button in result & tournament screens.*
6. **M6 — Missions & Weekly Boss** (daily + career objectives credited from any match; weekly Boss squad, one attempt/day; server-authoritative). ✅ *Convex + `/missions` implemented.*

---

## 7. Definition of done (acceptance)

- ✅ A solo match can be read in **Fast** or resolved in **Ultra Fast**, all from one timeline, with **skip** working in Fast.
- ✅ **Chemistry** and **tactics** measurably change λ and the result, and are visible in Build and stats.
- ✅ Up to 8 players on **different devices** join the pool, see the **same** server-resolved group standings, bracket, and champion the instant the tournament resolves, and can **search again with a new squad**; outcome is fully **server-decided**.
- ✅ A finished match produces a **working highlight link** (replays goals as text, previews with a share card) and a **stats** breakdown.
- ✅ **Missions** (daily + career) are credited from any match the player plays, server-side; the **Weekly Boss** is the same squad for everyone all week and enforces one attempt per day.
- ✅ **Fast text** and **Ultra Fast** are always available on all devices.

---

## 8. Success metrics (MVP)


| Metric                                          | Target   |
| ----------------------------------------------- | -------- |
| World Cup pools that fill with 8 humans (vs. bot-filled) | ≥ 50%    |
| Fast-mode adoption (matches read as ticker)     | ≥ 40%    |
| Highlight share rate (matches → links created)  | ≥ 15%    |
| Daily challenge participation (DAU who play it) | ≥ 25%    |
| Sync latency (p95)                              | < 400 ms |


---

## 9. Open decisions (MVP)

1. **Group-stage tiebreak beyond goal difference/goals scored:** head-to-head result vs straight alphabetical/slot order (only matters at this small 4-team scale).
2. **Tie-break (knockout):** penalties (recommended, implemented) vs higher band.
3. **Incomplete XI at draft end:** neutral auto-fill (recommended, implemented) vs penalty.
4. **Tactic δ** value and **chemistry range** (±3) — calibrate via playtests.
5. **Daily attempts:** strictly one official attempt vs best-of-N.
6. **Pool fill timeout** before CPU bot-fill kicks in (currently 60s) — calibrate against real queue traffic.
7. **CPU bot squad variety:** demo catalog now has 8 historical scenarios (enough for a 1-human/7-bot tournament without repeats); revisit if pool sizes grow.

# 7a0 — UI & Design Document

**Document:** Design analysis of 7a0 + design direction for our enhanced version
**Version:** 1.0
**Date:** 16 June 2026
**Author:** Gonçalo

> Language note: kept in English to match the PRD/MVP doc set. I can provide a Portuguese version on request.
> Part A documents 7a0's current design (recovered from its CSS/markup). Part B specifies **our** UI — same soul, more innovative, with **Three.js 3D** and richer motion.

---

# PART A — How 7a0 looks today (design analysis)

## A1. Design DNA in one line
**Retro football, in print.** A vintage mix of **Panini sticker album**, **matchday programme** and **CRT broadcast scoreboard**, rendered with hard offset shadows, heavy condensed type and monospace scoreboard numerals. It feels tactile, nostalgic and punchy — not a soft, modern "SaaS" UI.

## A2. Two themes (exact tokens)
7a0 ships **two switchable themes** (`.theme-panini`, `.theme-terrace`):

**Panini — light "sticker album / paper"**
| Token | Value |
|---|---|
| surface | `#F3ECD8` (cream paper) |
| surface-2 | `#FFFFFF` |
| ink (text) | `#1B1A17` |
| muted | `#6B6452` |
| accent | `#E8462B` (orange-red) |
| accent-2 | `#C8A24B` (gold) |
| pitch | `#2F7D4F` (grass) |
| line | `#D8CFB4` (beige) |
| display font | **Anton** | 
| body font | **Hanken Grotesk** |
| numeral font | **Archivo** |

**Terrace — dark "night match / CRT"**
| Token | Value |
|---|---|
| surface | `#0B1A12` (dark green-black) |
| surface-2 | `#0D0D0D` |
| ink (text) | `#EDE7D6` (cream) |
| muted | `#5F8A6F` |
| accent | `#E2342B` (red) |
| accent-2 | `#F5B11E` (amber) |
| pitch | `#0E2417` |
| line | `#1D4A2E` |
| **phosphor / win** | `#39FF7A` (CRT green glow) |
| display font | **Oswald** (700) |
| body font | **Space Grotesk** |
| numeral font | **Share Tech Mono** (monospace) |

## A3. Typography system
- **Display:** Anton / Oswald — heavy, condensed, uppercase. Reads like jersey numbers, scoreboards and programme headlines.
- **Body:** Hanken Grotesk / Space Grotesk — clean grotesques for legibility.
- **Numerals:** Archivo / **Share Tech Mono** — scoreboard digits; the mono in the Terrace theme gives a real "scoreboard tube" feel.

## A4. Surface & depth language
- **Hard offset shadows** (`3px 3px 0`, no blur) on cards/buttons — neo-brutalist **print/sticker** look (ink drop shadow), not Material elevation.
- Visible **borders/rules** (1–2px) and a cream "paper" or dark "pitch" ground.
- The whole thing reads as **physical objects** (stickers, cards, scoreboards) rather than flat panels.

## A5. Component vocabulary (observed)
- **Collectible cards** (`.card-collectible`, `.card-stage`, `.card-share-imgs`) — Panini-style player/result cards, built to be **shared as images**.
- **Pitch** (`.pitch`, `.pitch-hint`) — where you place the XI.
- **Scoreboard numerals** — the `7–:0` wordmark itself is a scoreboard with a blinking colon.
- **Bracket tree** (`.btk-*`) — the knockout (mata-mata) view, with rows for win/loss/tbd, "you", watch hints, mobile variant.
- **Broadcast camera** (`.cam-preview`, `--cam-w/--cam-h`) — a framed "camera" element, broadcast styling.
- **Buttons** — `.btn-primary / .btn-secondary / .btn-ghost`.
- **Achievement stamps / record badges** (`.badge-record`, stamp keyframes).

## A6. Motion language (it's already rich — all 2D/CSS)
7a0 leans hard into characterful keyframe animation (no 3D yet):
- **Dice/roll:** `rollPulse`, `rr-snap`, `prop-spin`.
- **Reveal sequences:** `rvGoalIn`, `rvKickIn`, `rvKickerIn`, `rvSnap` (goal & penalty drama).
- **Achievements:** `achv-stamp`, `achv-cut` — a stamp slamming down.
- **CRT atmosphere:** `offair-flicker` (off-air flicker), `lobby-blink`.
- **Campaign/road:** `road-pulse`, `plane-fly`, `riseIn`.
- **Draft/online:** `pickPulse`, `draftWaitingPulse`, `do-countdown`, `multiTurnPulse`.
- **Bracket:** `btk-cut-in`, `btk-sheet-in`.

## A7. Screen map (current)
- **Home** — hero "Role o dado." with legend names (Maradona, Beckenbauer, Ronaldo) and "Escale um craque que jogou ali"; entry to play and "Com amigos".
- **Play** — roll → build on the pitch → simulate → result card (shareable).
- **Multi** — three modes (Local, Cup Final, Knockout bracket) by code.
- **Profile** — almanac/achievements.
- **Settings** — theme toggle, mode, etc.

## A8. Honest assessment
**Strengths:** strong, original identity; tactile; shareable cards are great for virality; theme system is a nice touch; motion has personality.
**Gaps / our opportunity:** everything is **flat 2D/CSS**; the match is text-only (no spatial drama); cards are static images; no real depth, lighting, or "wow" moment; weak sense of *watching* football.

---

# PART B — Our UI (same soul, more innovative)

## B0. Design principle
**Keep the retro-football soul — add a living, three-dimensional layer.** We don't throw away the Panini/terrace/scoreboard identity; we **elevate it** with **Three.js** so key moments have real depth, light and motion, while *always* degrading gracefully to a 2D/CSS version for weak hardware (consistent with the MVP's 2D-first rule).

Our three motion/design pillars:
1. **Tactile** — hard-shadow, sticker-like, press-satisfying (inherited).
2. **Broadcast** — it should feel like a TV match: scoreboard, lower-thirds, replays.
3. **Collectible** — players and results are objects you'd want to keep and share.

## B1. Evolved design system

### Identity
- Create our **own wordmark and palette** (distinct from 7a0 — this is our product), keeping the **scoreboard motif** but original. Avoid copying 7a0's assets; the fonts we lean on (Anton/Oswald/Space Grotesk/Share Tech Mono) are open and fair to use, but the brand mark, illustrations and card frames must be original.
- Keep a **two-theme** structure but make them ours, e.g. **"Album"** (bright collectible) and **"Floodlight"** (night broadcast), plus the option of a **third "Broadcast HD"** theme tuned for the 3D match.

### Tokens (starting point)
- Reuse the *semantic* token set (`--surface`, `--ink`, `--accent`, `--accent-2`, `--pitch`, `--line`, `--win`, `--muted`) so theming stays clean.
- Add **3D/material tokens**: `--grass-base`, `--grass-stripe`, `--token-home`, `--token-away`, `--ball`, `--shadow-soft`, `--floodlight`, `--holo-foil`.
- Add **motion tokens**: `--ease-snap`, `--ease-broadcast`, `--dur-fast/med/slow`, plus a global `prefers-reduced-motion` switch that disables 3D camera moves and heavy keyframes.

### Type
- Display: heavy condensed (Anton/Oswald family) for headlines, scores, jersey numbers.
- Body: a clean grotesque (Space Grotesk / Hanken).
- Numerals: **mono scoreboard** (Share Tech Mono) for all scores, timers, ratings — our signature.

## B2. Where Three.js earns its place (the 3D layer)

3D is used **surgically**, only where it adds drama — never as decoration that taxes weak machines.

1. **The match — top-down 3D pitch** *(our headline feature)*
   - Grass plane with mown stripes, **instanced disc tokens** carrying **shirt numbers**, a **ball sphere**, soft **contact shadows**.
   - **Top-down** camera (orthographic; optional 5–10° micro-tilt), reading the same event timeline as the 2D renderer (3D is a *skin*, not a separate mode).
   - Broadcast overlay on top: scoreboard, clock, lower-third for goals/cards, mini "xG" ticker.

2. **3D dice roll**
   - A real die tumbles and settles to reveal **team + Cup** — replacing 7a0's 2D morph with a tactile, weighty roll (canned animation + a little easing; no physics engine needed).

3. **Holographic collectible cards** *(signature)*
   - The picked player, the result, and shareable cards become **3D cards** with **tilt-parallax** and a **foil/holo shader** for high-rated players; a **flip** reveals stats. This is the "Panini moment" reborn — and the most screenshot-worthy thing in the app.

4. **3D hero (home)**
   - A slow, cinematic hero: a floating **pitch / trophy / stadium** with drifting tokens, parallax and gentle depth-of-field. Sets the tone in two seconds. (Falls back to a static illustrated hero.)

5. **3D knockout bracket**
   - The mata-mata tree as a subtly **orbitable 3D structure**; matches **light up** as they resolve, the road to the final glowing.

6. **Build pitch with chemistry links**
   - The build view is a gently tilted 3D pitch; placed players **drop in** as cards; **chemistry** is drawn as **glowing links** between well-paired players; the **overall meter** and **attack/defense bars** update live.

7. **Stadium atmosphere (cosmetic)**
   - Per-Cup **era styling**: day/night, floodlights, crowd haze, period kits and ball. Pure flavour, all optional.

> **Performance rule:** every 3D moment has a **2D/CSS fallback** (dice, cards, match, hero, bracket). Auto-detect on first load (FPS sample + `prefers-reduced-motion` + WebGL check); manual toggle **3D / 2D / Text** in settings; remember the choice. Budgets: instanced tokens, one soft light, contact shadows only, no post-processing on low tiers.

## B3. Screen-by-screen (our version)

### Home
3D hero + a single bold **"Roll"** CTA; quick entries to **Online**, **Daily Challenge**, **Profile**; theme toggle. Legend names cycle as social proof.

### Roll
The **3D die** tumbles → reveals the **(team, Cup)** as a holo card sliding in. Reroll axes (team / Cup) shown as clear, scarce tokens (you *feel* spending one).

### Build (draft) — the core screen
- Tilted **3D pitch** with the formation's slots; pick a player → his **card flips in** and **drops** into the slot.
- **Tactic selector** (Offensive / Balanced / Defensive) as a physical 3-way switch that visibly shifts the team's shape on the pitch.
- **Chemistry meter** + glowing links; **live overall** and **attack/defense bars**.
- Position-eligibility made obvious: valid slots **glow**, invalid ones dim (the engine already enforces "this player plays this position").
- Rerolls and the **emergency reroll** are clearly metered.

### Watch (the match) — speed tiers
- **Normal:** the **2D or 3D top-down** match plays with broadcast overlay; **skip-to-result** and **1×/2×** always present.
- **Fast:** broadcast-style **minute-by-minute text** ticker (also the screen-reader path).
- **Ultra Fast:** instant scoreboard slam + badges.
- Goals, penalties and corners get short **broadcast reveals** (inheriting 7a0's `rvGoalIn`/`rvKickIn` energy, now in 3D).

### Result
- A **3D result card** (holo if it's a 7–0 / special), **side-by-side stats**, **badge stamps** that slam down (`achv-stamp` energy), and a one-tap **shareable highlight** (replays the goals; previews with an Open Graph card).

### Online (Duel)
- **Lobby** with code/invite, **presence** dots, synced **build timer**, a **countdown** to kickoff, then a **simultaneous reveal** of the server-decided result; **rematch** in one tap. (Server-authoritative — see PRD/MVP.)

### Daily challenge
- A featured **daily card** (same scenario for everyone), one official attempt, a simple **leaderboard**, and a share link.

### Profile / Almanac
- A **sticker-album** wall of unlocked badges and best results; collectible cards you've earned; online history.

## B4. Component library (to build)
Tokens & theming · Buttons (primary/secondary/ghost) · **Collectible card** (2D + 3D/holo variants) · **Pitch** (2D and 3D) · **Scoreboard** & clock · **Stat bars** & xG ticker · **Chemistry meter** + link lines · **Tactic switch** · **Dice** (2D + 3D) · **Bracket** (2D + 3D) · **Broadcast overlay** (lower-thirds, reveals) · **Badge stamp** · Lobby/presence · Toast/countdown · Theme toggle.

## B5. Motion principles
- **Snappy & tactile** for UI (hard-shadow press, sticker snaps) — keep 7a0's punch.
- **Broadcast-grade** for match drama (reveals, lower-thirds, replays).
- **Cinematic but brief** for 3D camera moves (hero, card flips, dice) — never block interaction; always skippable.
- **Reduced-motion first-class:** a single switch disables camera moves and heavy keyframes; the app stays fully usable in 2D/text.

## B6. Accessibility & responsiveness
- **Mobile-first**; the 3D match must run on a phone or fall back to 2D.
- **Text/Fast tier** is the accessible path (screen-reader friendly).
- Respect `prefers-reduced-motion` and color-contrast in both themes.
- Every 3D interaction has a non-3D equivalent.

## B7. What makes ours more innovative (summary)
1. A **watchable top-down match** in **2D and 3D** (Three.js) from one timeline — 7a0's match is text-only.
2. **Holographic, tiltable collectible cards** with foil shaders — 7a0's cards are static images.
3. A **3D dice roll**, **3D hero**, and **3D bracket** for real depth and "wow".
4. **Live chemistry links + tactic switch** visualised on a 3D build pitch.
5. **Broadcast-grade overlays** (scoreboard, lower-thirds, replays, xG ticker).
6. **Real-time online** with simultaneous reveals — each player at their own fidelity.
7. All of it **degrades gracefully** to 2D/CSS, so weak machines lose nothing essential.

---

## Appendix — quick token reference for our themes (starting values)

```css
/* Album (bright collectible) */
--surface:#F3ECD8; --surface-2:#FFFFFF; --ink:#1B1A17; --muted:#6B6452;
--accent:#E8462B; --accent-2:#C8A24B; --pitch:#2F7D4F; --line:#D8CFB4;
--win:#2F7D4F; --display:Anton; --body:"Hanken Grotesk"; --numeral:Archivo;

/* Floodlight (night broadcast / CRT) */
--surface:#0B1A12; --surface-2:#0D0D0D; --ink:#EDE7D6; --muted:#5F8A6F;
--accent:#E2342B; --accent-2:#F5B11E; --pitch:#0E2417; --line:#1D4A2E;
--win:#39FF7A; --phosphor:#39FF7A; --display:Oswald; --body:"Space Grotesk"; --numeral:"Share Tech Mono";

/* 3D / material additions (both themes) */
--grass-base; --grass-stripe; --token-home; --token-away; --ball;
--shadow-soft; --floodlight; --holo-foil;

/* motion */
--ease-snap; --ease-broadcast; --dur-fast; --dur-med; --dur-slow;
```

> These are **starting points inspired by 7a0's palette**, to be reworked into an **original brand** for our product (own wordmark, own card frames, own illustrations).
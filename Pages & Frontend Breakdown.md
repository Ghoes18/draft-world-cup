Pages & Frontend Breakdown

Document: Detailed front-end breakdown of 7a0's pages, layouts, component trees, state & flow
Version: 1.0
Date: 16 June 2026
Author: Gonçalo


Recovered from 7a0's live code (Next.js App Router, client-rendered game). Handler/reducer/class names quoted here are the real ones found in the bundles. Describes the current game; a matching breakdown for our version can follow in the same format.




Global architecture

Framework & routing. Next.js App Router with an [locale] dynamic segment for i18n (PT/EN/ES) — routes resolve as /[locale]/…. The game is a client component tree hydrated over a server-rendered shell (a Loading… state shows before hydration).

Root layout (app/[locale]/layout). Wraps every page with:


an i18n provider (translation keys like play.simulate, play.lineupComplete),
a ThemeProvider applying a class to a wrapper (.theme-panini | .theme-terrace) that exposes all design tokens as CSS custom properties,
a session context (better-auth; $sessionSignal, broadcastSessionUpdate, synced across tabs via BroadcastChannel).


Shared chrome. A persistent <Header> (scoreboard wordmark linking /, a Perfil link, an Ajustes ▾ dropdown) and a <Footer> (Ko-fi CTA, privacy link). Theme + settings persist client-side, so chrome is identical across routes.

Routes: / (home), /play, /multi, /perfil, /privacidade.


Route: / — Home (marketing landing)


Type: mostly static, SSR-friendly; minimal client JS.
Layout shell: single-column, centered hero, max-width container, large display type.
Component tree:
<Header> → <Hero> ( wordmark · tagline Role o dado. / Escale um craque que jogou ali · <LegendNames> ticker · primary <CTAButton> ) → <SecondaryEntry> ("Com amigos" → /multi) → <Footer>.
State/data: none meaningful; the legend ticker is a small CSS/interval animation.
Events: CTA click → client-side router.push('/play').
Responsive: fluid type via clamp(); hero stacks on mobile.



Settings (Ajustes) — overlay, not a route


Type: controlled dropdown/popover (.theme-toggle + settings menu); opens with a settings-cut keyframe.
Controls (persisted form state):

theme — Panini | Terrace
formation — 8 options (4-3-3, 4-4-2, 4-2-3-1, 4-2-4, 3-5-2, 5-3-2, 4-5-1, 3-4-3)
style — defensivo | equilibrado | ofensivo
mode — classico (3 rerolls, stats visible) | almanaque (1 reroll, stats hidden)



State: writes to a global preferences store (client state + persistence); ThemeProvider and the draft initializer read from it.
Why it matters: these are inputs to /play — they define the slot set and reroll budget before the draft starts.



Route: /play — the game (single-route state machine)

One route that transitions through phases via local state, not multiple pages.

Layout shell

A responsive two-column grid (col + col-pitch) that collapses to a stacked single column on mobile:


Left column — Roll/Pick panel (<RollPanel>, the I.i component)
Right column — Pitch (<Pitch>, the S.p component, .pitch)


A bottom/overlay action bar holds the Simulate button. On simulate, the view swaps to the <ResultCard> stage.

State model (client reducer)

The draft is a reducer-driven state machine. Initial state (from createDraft(prefs)):

ts{
  formation, style, mode,
  slots: SlotDef[],            // {pos, x, y} from formation × style
  filled: (Player | null)[],   // length 11, starts all null
  usedPlayerIds: string[],     // no player twice
  rerollsLeft: number          // 3 (classico) | 1 (almanaque)
}

Confirmed action types: roll, reroll (with an axis: selecao | copa), emergencyReroll, plus select/assign and swap. Reducer guards throw on invalid moves:
"Sem re-sorteios restantes", "Vaga inválida ou ocupada", "{name} não joga {pos}".

Key pure functions (real): createDraft, markSelectable, assignPlayerToSlot, swappableTargets, swap, isComplete, overall.

Left column — <RollPanel>


Props/handlers (real names): onRoll, onReroll(axis), onEmergencyReroll(axis), onSelectPlayer(player), selectedId.
Subcomponents:

<Dice> — roll CTA (rollPulse / rr-snap animation)
<DrawDisplay> — the drawn sel · copa
<PlayerPool> — eligible players for the current draw; each a <PlayerRow>/card with name, position, and force (hidden in almanaque)
<RerollControls> — reroll seleção / reroll Copa, showing rerollsLeft (roll.rerollCopa), plus emergency reroll



Derived UI: each pool entry is marked selectable = !used && hasOpenSlotForHisPositions (from markSelectable), so non-fitting players are disabled.


Right column — <Pitch>


Props/handlers: draft, highlight (slots to glow), onSlotPick(slotIndex), plus select/swap state (selectedSlot, swap targets).
Render: absolutely-positioned <Slot> nodes at each {x, y} (percent coords on the pitch). Empty slots show a position label; filled slots show a mini player card.
Two interaction modes:

Place — a player is selected in the pool → compatible empty slots highlight → onSlotPick assigns (pickPulse).
Rearrange — click a filled slot → valid swap targets highlight (swappableTargets; both must stay positionally legal) → click to swap/move (movePulse; hints play.hintMove / play.hintMoveActive).





Phase flow inside /play

PHASE: BUILD
  loop: onRoll → DrawDisplay + PlayerPool update → onSelectPlayer → onSlotPick (assign)
        (optional reroll / emergencyReroll; optional swap)
  when isComplete(draft) === true → show "play.lineupComplete", enable Simulate
PHASE: SIMULATE (button) → run engine (seeded) → produce result
PHASE: RESULT → mount <ResultCard>

A live HUD shows the running overall (Math.round(avg force)), and can show attack/defense bars while building.

<ResultCard> (result stage)


Props (real): result, xi, overall, seed, shareUrl, almanaque, eliminatedPhase, finalLine, onAgain.
Render: a collectible-style card (.card-collectible, .card-stage) with the campaign outcome, the 7–0 / eliminated line, badge stamps (achv-stamp / achv-cut), a Share action (uses /api/shorten; generates .card-share-imgs for Open-Graph previews), and Play again (onAgain resets the reducer with a new seed).



Route: /multi — multiplayer hub


Layout shell: a <ModeSelector> list of three <ModeCard>s + a <JoinByCode> input + a primary Start button.
Modes (cards):

01 Local — pass-and-play, same device
02 Final de Copa — build → straight to the Final
03 Mata-mata de Copa — bracket, 4–16, humans + CPU



State: selected mode, bracket size, and a room/seed code (same code = same draw).
Downstream views:

Local/Final → reuses the same build + simulate flow, alternating seats.
Mata-mata → a <BracketTree> (.btk-tree, .btk-col, .btk-match, .btk-row--win/--loss/--tbd/--mine) that animates rounds in (btk-cut-in, btk-sheet-in), lights up resolved matches, marks "you", and offers a watch affordance per match; a mobile variant (.btk-mobile) restructures the tree into a vertical list.



Important: all code/seed-based, not real-time — no socket layer; "sync" is shared determinism.



Route: /perfil — profile / almanac


Layout shell: a grid gallery of unlocked achievements (sticker-album metaphor).
Component tree: <Header> → <AlmanacGrid> of <BadgeCard> / <RecordBadge> (.badge-record) → records/history → <Footer>.
State/data: reads recorded results/badges (persisted; /api/match/record). Locked items render as empty "slots".



Cross-cutting frontend concerns


Rendering: SSR shell + client hydration; the game tree is client-only (Loading… fallback).
State management: a reducer for the draft (pure functions above); signals/context for session/theme/prefs.
Determinism: a seeded RNG (mulberry32) underlies roll + sim, enabling shareable codes and reproducible ResultCards.
Theming: all visuals via CSS custom properties scoped by .theme-panini / .theme-terrace; hard-shadow tokens (3px 3px 0) for the print/sticker look.
Motion: a large library of CSS @keyframes — dice (rr-snap), reveals (rvGoalIn, rvKickIn, rvKickerIn, rvSnap), stamps (achv-stamp), CRT (offair-flicker, lobby-blink), bracket (btk-*), draft (pickPulse, draftWaitingPulse). No 3D/WebGL anywhere today.
i18n: translation keys gate all copy; [locale] segment switches PT/EN/ES.
APIs (same-origin): /api/auth, /api/match/record, /api/metric, /api/shorten, /api/geo. Squad data from static /squads/{slug}.json.



Flow synthesis

/  (Home)
 │   hero → CTA
 ├─ Ajustes (overlay): theme · formation · style · mode
 │
 ├─ /play  ── single route, phases:
 │     BUILD  (RollPanel ⟷ Pitch):  roll → select player → place  ⟲ ×11
 │            → isComplete → SIMULATE → RESULT (<ResultCard>: badges · share · again)
 │
 ├─ /multi ── ModeSelector (Local | Final | Mata-mata) + code
 │            → build + simulate  /  <BracketTree>
 │
 └─ /perfil ── AlmanacGrid (badges, records, history)

One line: Home sets the hook → Ajustes sets the rules → /play is a two-column build screen (roll/pick left, pitch right) looping until simulate, then the same route becomes a shareable result card → /multi reuses that loop for 2 players / a bracket → /perfil stores progression.
ArtefatosBaixar tudo7a0 mvp specDocumento · MD Prd 7a0 online v2 enDocumento · MD Prd 7a0 modo onlineDocumento · MD 7a0 game guide and rulesDocumento · MD 7a0 ui designDocumento · MD 
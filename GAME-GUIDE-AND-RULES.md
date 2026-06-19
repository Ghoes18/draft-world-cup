## 1. What the game is

7a0 ("Sete a Zero") is a web football game built around **World Cup history, 1950–2026**. You're handed a random national team from a random World Cup, you pick a real star who was actually there, complete the starting eleven, and **simulate a tournament** to see if your dream team can win **7–0**.

- **~52 national teams**, **250 squads**, **5,729 real players** across the editions.
- Short sessions, deeply replayable, and built to be shared.

The name is the dream scoreline: **seven to nil**.

---

## 2. The core loop — Roll · Build · Simulate

**1) Scenario roll.** The game randomly draws a **national team** and a **World Cup edition** — one *(team, Cup)* pairing for the whole match. Example: *Brazil · 1970*. This is **not** repeated per player.

**2) Build your XI.** Fill **11 position slots** with players who **really represented that drawn team in that Cup**. For each slot the game offers a small set of **eligible candidates** (a **slot roll**); you pick one, or **reroll** to refresh that slot's options (plus a limited **emergency reroll** for tight spots). You can also pick your **tactic** and watch your **chemistry** rise as you place players well.

**3) Simulate.** Your team plays a **tournament campaign**. You watch (or read) the matches and find out if you go all the way — and whether you ever hit that **7–0**.

---

## 3. The objective

Your goals, in rising order of glory:

- **Win the match / campaign.**
- **Stay unbeaten** (invicto) across the campaign.
- **Become champion** (win the Final).
- **Win 7–0** — the signature result that gives the game its name.
- **Unlock badges** for special feats (see §11).

---

## 4. Building your team (rules)

- The XI has **11 position slots** (a goalkeeper, defenders, midfielders, forwards).
- **Eligibility rule:** you may only field players who actually played for the drawn **(team, Cup)**. The game only offers eligible players.
- **Scenario roll:** once per match — the *(team, Cup)* you build from.
- **Slot roll / reroll:** per position, the game draws a fresh batch of eligible candidates from that scenario's squad. Normal rerolls are **limited per slot**; **emergency rerolls** are a separate, smaller pool. Online, all rolls are **validated by the server** so everyone plays fair.
- **Placement matters:** putting a player in his **natural position** maximises his value and your **chemistry** (§6).
- **Complete the XI** before simulating. (Online, if you run out of time, empty slots are auto-filled.)

---

## 5. How results are decided (the match engine)

7a0 doesn't fake the football — it uses a clear probability model, so stronger, well-built teams win **more often**, but upsets still happen.

### 5.1 Team strength

Each player has one **force** rating. Your team's **attack**, **defense**, and **overall** are calculated from the **11 players you field**, using position weights (forwards weigh more on attack, defenders on defense). That derived strength is then adjusted by your **chemistry** (§6) and **tactic** (§7). The full squad is available when you build; only your chosen XI counts for the match.

### 5.2 Expected goals (λ)

For each team, the game computes **expected goals** for the match:

```
λ = clamp( 1.4 + (yourAttack − opponentDefense) × 0.08 , 0.15 , 5 )

```

- If the teams are even, λ ≈ **1.4** goals.
- Every point of advantage adds **0.08** to expected goals.
- λ is capped between **0.15** and **5**.

### 5.3 Goals scored

Each team's actual goals are drawn from a **Poisson distribution** with that λ. In plain terms: λ is the *average* you'd expect; the dice decide the *actual* number, so a strong team usually scores more but can still have an off day (and a weak team can nick one).

### 5.4 The result

Both teams roll their goals; compare them for **win / draw / loss**.

### 5.5 Knockout draws → penalties

In knockout matches, a draw goes to a **shootout**. Your chance of winning it:

```
penaltyWin = clamp( 0.5 + (strengthDifference) × 0.012 , 0.1 , 0.9 )

```

Even teams are a coin flip (0.5); a big favourite is capped at 0.9; a big underdog at 0.1 — so penalties are always a real gamble.

### 5.6 Fairness & determinism

Every match uses a **seed** (a hidden number). The same seed always produces the same draw and the same result — which is exactly what makes **shared links, the daily challenge, and replays** reproducible. In **online** and the **daily challenge**, the **server owns the seed and runs the simulation**, so results can't be tampered with.

### 5.7 How the match is shown (Fast & Ultra Fast)

The **scoreline is decided first** by the probability engine (§5.2–5.5). If you choose **Ultra Fast**, you see that result immediately — this is how 7a0 has always worked.

If you choose **Fast**, the game **replays** that same result as a **minute-by-minute text ticker**: goals, shots, corners, and penalties appear in order, but the final score was already fixed. You're reading a **scripted recap**, not a second simulation that could produce a different score. That's why switching speed tiers never changes what happened.

---

## 6. Squad chemistry (rules)

Chemistry rewards building a coherent eleven.

- **Position fit:** a player in his **natural position** counts fully; out of position counts less (full credit for the exact role, partial for an adjacent role, little for an unrelated one).
- **Chemistry %** is the weighted share of well-placed players, from **0 to 100**, shown as a live meter while you build.
- **Effect on strength:** chemistry shifts your overall by roughly **−3 to +3** points:

```
chemistryBonus = round( (chemistry% − 50) / 100 × 6 )

```

A perfectly placed XI gets the full **+3**; a messy one is penalised. That bonus feeds straight into your **attack and defense** in the engine — so chemistry can be the difference between a 5–0 and a 7–0.

---

## 7. Tactics (rules)

Before a match you choose **one tactic**. It's a genuine trade-off:


| Tactic        | What it does                                                            |
| ------------- | ----------------------------------------------------------------------- |
| **Offensive** | You score **more** but concede **more** (attack up, your defense down). |
| **Balanced**  | No change — steady.                                                     |
| **Defensive** | You score **less** but concede **less** (attack down, your defense up). |


- The shift is a few rating points each way, applied before computing λ.
- **Strategy tip:** go **Offensive** when you're hunting the 7–0 or need goals; switch **Defensive** to protect a lead in a knockout.

---

## 8. The campaign (tournament structure)

A solo campaign mirrors a World Cup run, with opponents getting tougher each round:


| Phase            | Format    | Opponent strength (overall) |
| ---------------- | --------- | --------------------------- |
| **Group stage**  | 3 matches | 68, 72, 76                  |
| **Round of 16**  | knockout  | 79                          |
| **Quarterfinal** | knockout  | 83                          |
| **Semifinal**    | knockout  | 87                          |
| **Final**        | knockout  | 91                          |


Win the Final to be **champion**; survive every game to stay **unbeaten**.

---

## 9. Watching the match — speed tiers

The **result is fixed before you read it** (see §5.7). **How you experience it** is your choice:

- **Fast** — a **minute-by-minute text** ticker of the key moments. Play, pause, restart, or skip to the result anytime. (Also the best mode for screen readers.)
- **Ultra Fast** — the **instant final score** and badges, like the original 7a0.

Both are powered by the same underlying match, so you can switch freely without changing what happened.

---

## 10. Match statistics

After a match you get a breakdown for both teams:

- **Possession %**, **shots**, **shots on target**, **corners**, **penalties**, **passes**, and an approximate **xG** (expected goals). These let you see *how* the scoreline happened — and compare with your opponent online.

---

## 11. Badges & achievements

Special feats unlock **badges**, for example:

- **7–0** — the dream scoreline.
- **Unbeaten** — no losses across the campaign.
- **Champion** — win the Final.
- **Esmagador / Massacre** — huge goal margins (e.g., goal difference ≥ 18 over a campaign).
- Scoring milestones and streaks tracked over time in your profile/almanac.

---

## 12. Playing online (rules)

**Online Duel (1v1):** you and another player connect from **different devices** and go head-to-head.

- Both receive a scenario; each **builds an XI** within a **timer**, picks a **tactic**, and confirms.
- The **server simulates** the match (server-authoritative — nobody can rig it) and both players see the **same result** at the same time, each in Fast or Ultra Fast.
- **Winner** is shown with a **side-by-side stats comparison**; one tap to **rematch** (new draw).
- If someone **leaves or goes idle**, the opponent is awarded the win; a brief **reconnect** window covers accidental drops.
- **Win rule (default):** the two elevens **face each other** in one match; a tie goes to **penalties**.

*(Ranking/ELO, leaderboards, online brackets and the Cup Final mode come after the MVP.)*

---

## 13. Daily challenge (rules)

- Every day, **everyone gets the same scenario** (the same team + Cup), set by a **daily seed**.
- You get **one official attempt** that counts for the day; you can practise freely afterwards.
- Compare your result on a **daily leaderboard** and **share** your run via a highlight link.
- It's **server-authoritative**, so the daily comparison is fair for everyone.

---

## 14. Sharing & highlights

- Any match can produce a **shareable highlight link** that **replays the goals** as text commentary for whoever opens it (no login needed to read).
- Links come with a **share card** (scoreline, team/Cup, badges) that previews nicely when posted.
- Because matches are seed-based, a shared link reproduces the **exact** match.

---

## 15. Glossary

- **Overall** — a team's overall strength rating.
- **Band** — a team's strength range/tier.
- **λ (lambda)** — expected goals for a team in a match.
- **Poisson** — the probability model that turns expected goals into an actual scoreline.
- **Chemistry** — how well your XI is put together; nudges your strength.
- **Tactic** — Offensive / Balanced / Defensive; trades scoring for solidity.
- **Scenario roll** — the one-time draw of *(national team, World Cup edition)* that defines your squad pool.
- **Slot roll** — the per-position draw of eligible player candidates from that scenario's squad.
- **Reroll** — refresh the candidate batch for one slot (limited per slot).
- **Emergency reroll** — a separate, limited reroll for a tight spot.
- **Seed** — the hidden number that makes a match reproducible and shareable.
- **Server-authoritative** — the server decides the result, so online/daily play can't be cheated.

---

## 16. Quick-start summary

1. **Roll** → get a team + Cup.
2. **Build** your XI from real players; place them well for **chemistry**; pick a **tactic**.
3. **Simulate** — read in **Fast**, or get the **instant** result in **Ultra Fast**.
4. Chase **7–0**, go **unbeaten**, be **champion**, collect **badges**.
5. **Challenge a friend online**, take on the **daily challenge**, and **share your highlights**.


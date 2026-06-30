# Smoke test log — v0.1.0 (local production artefact)

**Date:** 2026-06-30  
**Server:** `pnpm start` on `http://localhost:3001` (production build)  
**Convex:** dev deployment (`compassionate-perch-297`)  
**Auth:** not signed in (Mode C gates verified)

## 3.1 Solo — `/`

| Check | Result |
| ----- | ------ |
| Catalog loads | Pass — PT UI after ~2s |
| Formation picker before XI | Pass — 5 schemes, offensive/defensive labels |
| Draft roll + squad | Pass — Ghana 2006 scenario, player list + empty pitch slots |
| Header nav + broadcast bar | Pass — PR #8 |
| Sign in button | Pass |

Not exercised in this pass (requires full XI + kick off): tournament resolve, Fast/Ultra Fast in-match, stats panel, highlight generation from result.

## 3.2 Online — `/duel`

| Check | Result |
| ----- | ------ |
| Auth gate (Mode C) | Pass — Google, magic link, email/password tabs |
| Wizard without session | Blocked by design until sign-in |

Not exercised: two-browser pool, bot fill, bracket sync (requires authenticated sessions).

## 3.3 Missions — `/missions`

| Check | Result |
| ----- | ------ |
| Route loads | Pass — catalog then auth expected |
| Auth gate | Pass (same pattern as duel) |

## 3.4 Leaderboard — `/leaderboard`

| Check | Result |
| ----- | ------ |
| Route loads | Pass — session check → auth gate |

## 3.5 i18n

| Check | Result |
| ----- | ------ |
| PT default | Pass |
| EN / ES toggles present | Pass (header on all routes) |

## 3.6 Highlights — `/h/[code]`

| Check | Result |
| ----- | ----- |
| Public access (no login) | Pass |
| OG title | Pass — `Your XI 3–1 Croatia · England · 2018` |
| Fast controls | Pass — play/pause, skip, speed tier buttons |

## Automated verification (§2)

- `pnpm test`: 278/278 pass (with network)
- `pnpm typecheck` + `pnpm build`: pass (root)
- `apps/web` typecheck + `next build`: pass (after `rm -rf .next`)
- `npx convex dev --once`: pass

## Post-deploy still required (§4.3)

- Two real devices on prod `/duel`
- Google OAuth on production domain
- WhatsApp/Twitter OG preview on prod URL
- Convex dashboard error monitoring

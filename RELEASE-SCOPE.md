# Release scope — v0.1.0 (Mode C)

**Launch mode:** C — public solo + online tournament + missions + leaderboard; Better Auth required for competitive features.

**Target:** MVP M1–M6 as defined in [MVP.md](./MVP.md).

**Branch:** `release/v0.1.0` (cut from `main` after PR #7 Better Auth + PR #8 header redesign).

---

## In scope (this release)

| Area | Routes / surface | Notes |
| ---- | ---------------- | ----- |
| Solo campaign | `/` | Draft roll, formation picker, slot-first XI build, 5 rerolls, solo tournament (groups → knockouts) |
| Speed tiers | All match flows | Fast text ticker + Ultra Fast instant; same timeline |
| Match stats | Post-match | Possession, shots, corners, xG, etc. (M3) |
| Chemistry & tactics | Build + engine | Inter-player links (`src/synergy.ts`); Offensive / Balanced / Defensive |
| Shareable highlights | `/h/[code]` | Public, no login; OG preview |
| Online tournament | `/duel` | 8-player pool, server-resolved bracket, bot fill on timeout |
| Missions & Boss | `/missions` | Daily + persistent missions; weekly Boss, 1 attempt/day UTC |
| Leaderboard | `/leaderboard` | ELO after online tournament |
| Auth (Mode C) | Sign-in panel | Google OAuth, magic link, email; guards on duel/missions/leaderboard |
| i18n | PT / EN / ES | Language switcher |
| Polish | UI | Broadcast header, Captain Tsubasa easter egg, sound tiers, legend headshots |

---

## Out of scope (defer)

- Animated match views (2D/3D/video)
- Ranked / skill-based matchmaking beyond random pool
- GitHub Actions CI (follow-up; run local verify before deploy)
- README / DUEL-SETUP doc refresh (§9 follow-up)
- Rate limiting on public mutations
- Native apps, monetisation, leagues/seasons

---

## Known acceptance (MVP §7)

Validated in staging/local before prod deploy; production sign-off in [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) §5.

---

## Deploy artefacts

- Engine: `pnpm build` → `7a0-engine/dist` (Convex bundles this)
- Catalog: `apps/web/public/catalog.json` (~5 MB, 489 scenarios)
- Convex prod deployment + Vercel with env vars per [apps/web/AUTH-SETUP.md](./apps/web/AUTH-SETUP.md)

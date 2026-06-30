# Authentication setup (Better Auth + Convex)

Server-side identity for **mode C** launch: missions, online tournament, boss, and ELO ranking require a signed-in user. Solo play and highlights remain public.

## One-time setup

```bash
# Engine (Convex bundles dist/)
pnpm build

cd apps/web
pnpm install
npx convex dev   # first run: login + writes .env.local
```

### Convex environment

```bash
cd apps/web
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL http://localhost:3000
npx convex env set GOOGLE_CLIENT_ID "<your-google-oauth-client-id>"
npx convex env set GOOGLE_CLIENT_SECRET "<your-google-oauth-client-secret>"
```

### Next.js `.env.local`

See [`.env.example`](./.env.example). Required:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL` (`.convex.site` URL from dashboard)
- `NEXT_PUBLIC_SITE_URL`

### Google OAuth

1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (and production URL).
3. Copy client ID/secret to Convex env vars above.

### Production (Mode C deploy)

Set Convex **production** env (dashboard or `npx convex env set --prod`):

```bash
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)" --prod
npx convex env set SITE_URL https://your-domain.com --prod
npx convex env set GOOGLE_CLIENT_ID "…" --prod
npx convex env set GOOGLE_CLIENT_SECRET "…" --prod
# Optional: RESEND_API_KEY, AUTH_EMAIL_FROM for magic link in prod
```

Google Cloud Console — add authorized redirect URI:

- `https://your-domain.com/api/auth/callback/google`

Vercel (or host) env:

- `NEXT_PUBLIC_CONVEX_URL` — production `.convex.cloud` URL
- `NEXT_PUBLIC_CONVEX_SITE_URL` — production `.convex.site` URL
- `NEXT_PUBLIC_SITE_URL` — `https://your-domain.com`

After deploy, smoke-test sign-in on `/duel` and `/missions` before opening traffic.


Magic link uses the Better Auth `magicLink` plugin. Emails are sent via [Resend](https://resend.com) when configured:

```bash
npx convex env set RESEND_API_KEY "re_…"
npx convex env set AUTH_EMAIL_FROM "NINETY <auth@yourdomain.com>"
```

**Local dev without Resend:** omit `RESEND_API_KEY` — the sign-in URL is printed to the Convex function logs when someone requests a link. Open the Convex dashboard → Logs to copy it.

### Email & password

Enabled alongside magic link and Google. Users can create an account or sign in from the **Email & password** tab (min. 8 characters). No email verification required in MVP.

## Dev

```bash
# Terminal 1
cd apps/web && npx convex dev

# Terminal 2
pnpm --filter web dev
```

Sign in via **Sign in** in the header or the gate on `/missions`, `/duel`, `/leaderboard`.

## Architecture

- [`convex/auth.ts`](./convex/auth.ts) — Better Auth instance + `getCurrentUser` query
- [`convex/lib/customFunctions.ts`](./convex/lib/customFunctions.ts) — `authedQuery` / `authedMutation` (derive `playerId` from session, never from client args)
- [`app/api/auth/[...all]/route.ts`](./app/api/auth/[...all]/route.ts) — Next.js proxy to Convex HTTP routes
- Protected mutations: `missions.myMissions`, `solo.recordMatch`, `boss.*`, `tournament.joinQueue`, `ratings.myRating`, etc.

Public without login: `/` (solo), `/h/[code]` (highlights). Mission credit on solo requires sign-in.

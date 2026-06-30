# Production deploy — v0.1.0 Mode C

## Convex (done)

**Production URL:** `https://optimistic-narwhal-380.convex.cloud`  
**Dashboard:** https://dashboard.convex.dev/t/goncalo-guimaraes/ninety90/optimistic-narwhal-380

Functions deployed from `release/v0.1.0` with `npx convex deploy --yes --cmd 'cd ../.. && pnpm build'`.

### Required prod env (Convex)

Set before opening traffic (auth will fail until complete):

```bash
cd apps/web

# Already generated — run once if not set:
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)" --prod

# Replace with your production domain:
npx convex env set SITE_URL https://YOUR_DOMAIN --prod

# Google OAuth (Google Cloud Console → credentials):
npx convex env set GOOGLE_CLIENT_ID "…" --prod
npx convex env set GOOGLE_CLIENT_SECRET "…" --prod

# Optional magic link:
npx convex env set RESEND_API_KEY "re_…" --prod
npx convex env set AUTH_EMAIL_FROM "NINETY <auth@yourdomain.com>" --prod
```

Google redirect URI: `https://YOUR_DOMAIN/api/auth/callback/google`

## Vercel (Next.js)

Set project env:

| Variable | Value |
| -------- | ----- |
| `NEXT_PUBLIC_CONVEX_URL` | `https://optimistic-narwhal-380.convex.cloud` |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | `https://optimistic-narwhal-380.convex.site` |
| `NEXT_PUBLIC_SITE_URL` | `https://YOUR_DOMAIN` |

Deploy:

```bash
cd apps/web
pnpm build
npx vercel --prod
```

Or connect GitHub repo in Vercel dashboard with root `apps/web`.

## §4.3 post-deploy checklist

- [ ] Solo full flow on prod URL
- [ ] Sign in (Google) on `/duel`
- [ ] Two devices: join pool, tournament resolves
- [ ] Share highlight link — OG preview on WhatsApp/Twitter
- [ ] Convex dashboard: no error spikes on `joinQueue`, `recordMatch`, `challengeBoss`

## Rollback

```bash
git tag v0.1.0   # after successful prod validation
npx convex deploy --yes --cmd 'cd ../.. && pnpm build'  # from previous tag checkout
# Vercel: promote previous deployment
```

#!/usr/bin/env bash
# Production deploy helper for Mode C (v0.1.0).
# Run from repo root after §2 verification passes.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Building engine (Convex bundles dist/)"
pnpm build

echo "==> Building Next.js"
cd apps/web
pnpm build

echo ""
echo "==> Convex production deploy"
echo "Ensure prod env vars are set (see AUTH-SETUP.md):"
echo "  BETTER_AUTH_SECRET, SITE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
echo ""
read -r -p "Deploy Convex to PRODUCTION? [y/N] " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
  npx convex deploy
else
  echo "Skipped Convex deploy."
fi

echo ""
echo "==> Vercel"
echo "Set on Vercel project:"
echo "  NEXT_PUBLIC_CONVEX_URL, NEXT_PUBLIC_CONVEX_SITE_URL, NEXT_PUBLIC_SITE_URL"
echo ""
echo "Then: vercel --prod   (or promote deployment in Vercel dashboard)"
echo ""
echo "Post-deploy: run §4.3 checks in RELEASE-CHECKLIST.md"

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the monorepo root so Next doesn't pick up a stray lockfile elsewhere.
  outputFileTracingRoot: repoRoot,
  // The engine ships raw TypeScript source (no build step); let Next compile it.
  transpilePackages: ["7a0-engine"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
    ],
  },
  webpack: (config) => {
    // 7a0-engine source uses NodeNext-style ".js" specifiers that resolve to
    // ".ts" sources. Teach webpack to follow them. Run `next dev` (webpack),
    // not Turbopack, so this aliasing stays reliable.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;

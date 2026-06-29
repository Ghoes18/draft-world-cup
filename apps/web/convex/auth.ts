import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { v } from "convex/values";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        accessType: "offline",
        prompt: "select_account",
      },
    },
    plugins: [convex({ authConfig })],
  });
};

const authUserValidator = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string(),
  image: v.optional(v.union(v.string(), v.null())),
});

/** Current signed-in user, or null when anonymous. */
export const getCurrentUser = query({
  args: {},
  returns: v.union(v.null(), authUserValidator),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      image: user.image ?? undefined,
    };
  },
});

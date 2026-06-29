import { customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { mutation, query } from "../_generated/server";
import { authComponent } from "../auth";

export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    return { ctx: { ...ctx, user, playerId: user._id }, args };
  },
});

export const authedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    return { ctx: { ...ctx, user, playerId: user._id }, args };
  },
});

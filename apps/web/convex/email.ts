import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";

/** Queue a magic-link email (Resend in prod, console log in dev). */
export async function sendMagicLinkEmail(
  ctx: ActionCtx,
  args: { to: string; url: string },
): Promise<void> {
  await ctx.runAction(internal.emailActions.deliverMagicLink, args);
}

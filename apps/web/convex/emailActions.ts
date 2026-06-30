"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";

/**
 * Delivers a magic-link email. Uses Resend when RESEND_API_KEY is set; otherwise
 * logs the URL to Convex logs (local dev).
 */
export const deliverMagicLink = internalAction({
  args: {
    to: v.string(),
    url: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, { to, url }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log(`[auth] Magic link for ${to}:\n${url}`);
      return null;
    }

    const from = process.env.AUTH_EMAIL_FROM ?? "NINETY <onboarding@resend.dev>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Sign in to NINETY",
        html: [
          "<p>Click the link below to sign in to NINETY. It expires in a few minutes.</p>",
          `<p><a href="${url}">Sign in</a></p>`,
          "<p>If you did not request this, you can ignore this email.</p>",
        ].join(""),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[auth] Resend error:", body);
      throw new Error("Failed to send magic link email");
    }

    return null;
  },
});

"use client";

/**
 * ShareHighlight — turns a finished match into a shareable highlight link (MVP
 * §4.3). The whole match is encoded into the URL (goals only, self-contained),
 * so the link replays without a catalog, a DB, or a login.
 *
 * Shortening is optional: if NEXT_PUBLIC_SHORTEN_URL is set we POST the long
 * link to it and use the returned short link; otherwise (and on any failure) we
 * fall back to the full self-contained link, which always works.
 */

import { useState } from "react";
import { encodeHighlight, toHighlight, type MatchTimeline } from "7a0-engine";
import { useStrings } from "../_i18n/LocaleProvider";

const SHORTEN_URL = process.env.NEXT_PUBLIC_SHORTEN_URL;

async function maybeShorten(longUrl: string): Promise<string> {
  if (!SHORTEN_URL) return longUrl;
  try {
    const res = await fetch(SHORTEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: longUrl }),
    });
    if (!res.ok) return longUrl;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const data = (await res.json()) as Record<string, unknown>;
      const short = data.short ?? data.shortUrl ?? data.url;
      return typeof short === "string" && short ? short : longUrl;
    }
    const text = (await res.text()).trim();
    return text || longUrl;
  } catch {
    return longUrl;
  }
}

export function ShareHighlight({
  timeline,
  homeLabel,
  awayLabel,
  awayTag,
}: {
  timeline: MatchTimeline;
  homeLabel: string;
  awayLabel: string;
  awayTag?: string;
}) {
  const S = useStrings();
  const [link, setLink] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "building" | "copied" | "failed">("idle");

  async function buildAndCopy() {
    setState("building");
    try {
      const code = encodeHighlight(
        toHighlight(timeline, { labels: { home: homeLabel, away: awayLabel }, awayTag }),
      );
      const longUrl = `${window.location.origin}/h/${code}`;
      const url = await maybeShorten(longUrl);
      setLink(url);
      try {
        await navigator.clipboard?.writeText(url);
        setState("copied");
        setTimeout(() => setState("idle"), 2000);
      } catch {
        setState("idle"); // link is shown; clipboard just wasn't available
      }
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="share">
      <button className="share__btn" type="button" onClick={buildAndCopy} disabled={state === "building"}>
        {state === "building"
          ? S.share.building
          : state === "copied"
            ? `✓ ${S.share.copied}`
            : `🔗 ${S.share.button}`}
      </button>
      {state === "failed" && <p className="dim">{S.share.failed}</p>}
      {link && (
        <div className="share__link">
          <input className="mono" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(link);
              setState("copied");
              setTimeout(() => setState("idle"), 2000);
            }}
          >
            {state === "copied" ? S.share.copied : S.share.copy}
          </button>
        </div>
      )}
      {link && <p className="share__hint dim">{S.share.hint}</p>}
    </div>
  );
}

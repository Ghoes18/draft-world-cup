"use client";

import { useState } from "react";
import {
  isCaptainTsubasaTeam,
  playerInitials,
  playerTier,
  type PlayerCard,
  type PlayerTier,
} from "7a0-engine";
import { tierFrameClass, tierFoilClass } from "../_lib/tierClasses";

export function PlayerAvatar({
  player,
  size = "md",
  selected = false,
  tier,
  className = "",
}: {
  player: Pick<
    PlayerCard,
    "name" | "photoUrl" | "team" | "overall" | "force" | "shirtNumber"
  >;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  /** Pre-resolved tier; computed from the player when omitted. */
  tier?: PlayerTier;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(player.photoUrl) && !failed;
  const initials = playerInitials(player.name);
  const resolvedTier = tier ?? playerTier(player);
  const foil = tierFoilClass(resolvedTier);
  // Manga dream-team easter egg: keep the electric-blue frame whether or not a
  // real headshot is present; when none loads, fall back to a holo number-card
  // (no licensed portraits exist, so the deployer supplies the images).
  const isTsubasa = isCaptainTsubasaTeam(player.team);

  return (
    <span
      className={[
        "player-avatar",
        `player-avatar--${size}`,
        selected ? "player-avatar--selected" : "",
        tierFrameClass(resolvedTier),
        foil ?? "",
        showPhoto ? "player-avatar--photo" : "player-avatar--fallback",
        isTsubasa ? "player-avatar--tsubasa" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={showPhoto ? undefined : true}
    >
      {showPhoto ? (
        <img
          src={player.photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="player-avatar__img"
          onError={() => setFailed(true)}
        />
      ) : isTsubasa ? (
        <>
          <span className="player-avatar__ct-aura" aria-hidden />
          {player.shirtNumber != null && (
            <span className="player-avatar__ct-num" aria-hidden>
              {player.shirtNumber}
            </span>
          )}
          <span className="player-avatar__initials player-avatar__ct-initials">
            {initials}
          </span>
        </>
      ) : (
        <span className="player-avatar__initials">{initials}</span>
      )}
    </span>
  );
}

"use client";

import { useState } from "react";
import { isLegendPlayer, playerInitials, type PlayerCard } from "7a0-engine";

export function PlayerAvatar({
  player,
  size = "md",
  selected = false,
  className = "",
}: {
  player: Pick<PlayerCard, "name" | "photoUrl">;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(player.photoUrl) && !failed;
  const initials = playerInitials(player.name);
  const legend = isLegendPlayer(player.name);

  return (
    <span
      className={[
        "player-avatar",
        `player-avatar--${size}`,
        selected ? "player-avatar--selected" : "",
        legend ? "player-avatar--legend" : "",
        legend ? "holo-foil" : "",
        showPhoto ? "player-avatar--photo" : "player-avatar--fallback",
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
      ) : (
        <span className="player-avatar__initials">{initials}</span>
      )}
    </span>
  );
}

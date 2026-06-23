import { describe, expect, it } from "vitest";
import {
  commonsThumbUrl,
  photoIsProtected,
  playerInitials,
} from "../src/playerPhoto.js";

describe("playerPhoto", () => {
  it("builds Commons thumbnail URLs", () => {
    expect(commonsThumbUrl("Pelé in Brazil.jpg", 128)).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/Pel%C3%A9%20in%20Brazil.jpg?width=128",
    );
    expect(commonsThumbUrl("File:Example.png")).toContain("Example.png");
  });

  it("derives initials from player names", () => {
    expect(playerInitials("Diego Maradona")).toBe("DM");
    expect(playerInitials("Pelé")).toBe("PE");
    expect(playerInitials("not applicable Pelé")).toBe("PE");
  });

  it("protects curated and external photo sources", () => {
    expect(photoIsProtected("curated")).toBe(true);
    expect(photoIsProtected("external")).toBe(true);
    expect(photoIsProtected("wikimedia")).toBe(false);
    expect(photoIsProtected(undefined)).toBe(false);
  });
});

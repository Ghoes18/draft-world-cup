import { simulateMatch } from "../src/engine.js";
import { defaultLineup } from "../src/lineup.js";
import { generateTimeline } from "../src/timeline/generate.js";
import { simulateLiveMatch } from "../src/live/simulator.js";
import {
  MatchPlayer,
  loadPersistedRate,
  loadPersistedTier,
  type SpeedTier,
} from "../src/render/player.js";
import { LiveMatchPlayer } from "../src/render/livePlayer.js";
import { RATE_FAST, RATE_NORMAL } from "../src/render/constants.js";

type DemoMode = "replay" | "live";

const canvas = document.getElementById("pitch") as HTMLCanvasElement;
const fastText = document.getElementById("fast-text") as HTMLElement;
const resultEl = document.getElementById("result")!;
const fpsEl = document.getElementById("fps")!;

const homeInput = document.getElementById("home-overall") as HTMLInputElement;
const awayInput = document.getElementById("away-overall") as HTMLInputElement;
const seedInput = document.getElementById("seed") as HTMLInputElement;
const knockoutInput = document.getElementById("knockout") as HTMLInputElement;
const modeSelect = document.getElementById("mode") as HTMLSelectElement;
const rateSelect = document.getElementById("rate") as HTMLSelectElement;
const tierSelect = document.getElementById("tier") as HTMLSelectElement;

function strength(overall: number) {
  return { attack: overall, defense: overall, overall };
}

function currentMode(): DemoMode {
  return modeSelect.value === "live" ? "live" : "replay";
}

function buildTimeline() {
  const seed = seedInput.value.trim() || "demo-seed";
  const home = strength(Number(homeInput.value));
  const away = strength(Number(awayInput.value));
  const knockout = knockoutInput.checked;
  const result = simulateMatch({ home, away, seed, knockout });
  const timeline = generateTimeline({
    result,
    seed,
    scenario: { team: "Demo", cup: 2026 },
    lineups: { home: defaultLineup("home"), away: defaultLineup("away") },
  });
  const pen = timeline.result.penalties
    ? ` (pens ${timeline.result.penalties[0]}–${timeline.result.penalties[1]})`
    : "";
  resultEl.textContent = `Replay FT ${timeline.result.score[0]}–${timeline.result.score[1]}${pen} · seed ${seed}`;
  return timeline;
}

function buildLive() {
  const seed = seedInput.value.trim() || "demo-seed";
  const homeOverall = Number(homeInput.value);
  const awayOverall = Number(awayInput.value);
  const result = simulateLiveMatch({
    seed,
    lineups: {
      home: defaultLineup("home"),
      away: defaultLineup("away"),
    },
    tactics: { home: "balanced", away: "balanced" },
    teamOveralls: { home: homeOverall, away: awayOverall },
    knockout: knockoutInput.checked,
  }, { snapshotStride: 2 });
  const pen = result.shootout
    ? ` (pens ${result.shootout.tally[0]}–${result.shootout.tally[1]})`
    : "";
  const win =
    result.winner === "draw"
      ? "Draw"
      : result.winner === "home"
        ? "Home win"
        : "Away win";
  resultEl.textContent = `Live AI FT ${result.score[0]}–${result.score[1]}${pen} · ${win} · seed ${seed} · ${result.events.length} events`;
  return result.snapshots;
}

type ActivePlayer = MatchPlayer | LiveMatchPlayer;

let player: ActivePlayer;

function createPlayer(): ActivePlayer {
  if (currentMode() === "live") {
    tierSelect.disabled = true;
    fastText.style.display = "none";
    return new LiveMatchPlayer(buildLive(), {
      canvas,
      onFps: (fps) => {
        fpsEl.textContent = `FPS: ${fps}`;
      },
    });
  }
  tierSelect.disabled = false;
  return new MatchPlayer(buildTimeline(), {
    canvas,
    textContainer: fastText,
    onFps: (fps) => {
      fpsEl.textContent = `FPS: ${fps}`;
    },
  });
}

player = createPlayer();

// Restore persisted prefs
tierSelect.value = loadPersistedTier();
rateSelect.value = String(loadPersistedRate());

document.getElementById("simulate")!.addEventListener("click", () => {
  player.destroy();
  player = createPlayer();
  if (player instanceof MatchPlayer) {
    player.setTier(tierSelect.value as SpeedTier);
    player.setRate(Number(rateSelect.value) === RATE_FAST ? RATE_FAST : RATE_NORMAL);
  } else {
    player.setRate(Number(rateSelect.value) === RATE_FAST ? RATE_FAST : RATE_NORMAL);
  }
});

document.getElementById("play")!.addEventListener("click", () => player.play());
document.getElementById("pause")!.addEventListener("click", () => player.pause());
document.getElementById("skip")!.addEventListener("click", () => player.skipToEnd());

rateSelect.addEventListener("change", () => {
  const rate = Number(rateSelect.value) === RATE_FAST ? RATE_FAST : RATE_NORMAL;
  if (player instanceof MatchPlayer) player.setRate(rate);
  else player.setRate(rate);
});

tierSelect.addEventListener("change", () => {
  if (player instanceof MatchPlayer) {
    player.setTier(tierSelect.value as SpeedTier);
  }
});

modeSelect.addEventListener("change", () => {
  player.destroy();
  player = createPlayer();
});

import { ImageResponse } from "next/og";
import { decodeHighlight, highlightBadges } from "7a0-engine";
import { formatScenarioLabel } from "../../_data/teamDisplay";
import { getServerStrings } from "../../_i18n/server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Floodlit palette (CSS vars aren't available in the OG renderer).
const TURF = "#06120c";
const PANEL = "#0a1e14";
const CHALK = "#eaf2ec";
const CHALK_DIM = "#6f8579";
const HOME = "#c6f24e";
const AWAY = "#ff5436";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { strings: S } = await getServerStrings();
  const { code } = await params;

  let payload: ReturnType<typeof decodeHighlight> | null = null;
  try {
    payload = decodeHighlight(code);
  } catch {
    payload = null;
  }

  if (!payload) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: TURF,
            color: CHALK,
            fontSize: 64,
            fontWeight: 800,
          }}
        >
          NINETY
        </div>
      ),
      size,
    );
  }

  const scenario = formatScenarioLabel(payload.scn[0], payload.scn[1]);
  const badges = highlightBadges(payload);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `linear-gradient(135deg, ${TURF} 0%, ${PANEL} 100%)`,
          color: CHALK,
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: 2, color: HOME }}>NINETY</span>
          <span style={{ fontSize: 34, color: CHALK_DIM }}>{scenario}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 48 }}>
          <span
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: HOME,
              maxWidth: 360,
              textAlign: "right",
              display: "flex",
            }}
          >
            {payload.lb[0]}
          </span>
          <span style={{ fontSize: 150, fontWeight: 900, display: "flex" }}>
            {payload.sc[0]}–{payload.sc[1]}
          </span>
          <span
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: AWAY,
              maxWidth: 360,
              textAlign: "left",
              display: "flex",
            }}
          >
            {payload.lb[1]}
          </span>
        </div>

        <div style={{ display: "flex", gap: 18, alignItems: "center", minHeight: 60 }}>
          {badges.length > 0 ? (
            badges.map((b) => {
              const bg = b.id === "esmagador" ? AWAY : b.id === "clean-sheet" ? CHALK : HOME;
              const fg = b.id === "esmagador" ? CHALK : TURF;
              return (
                <span
                  key={b.id}
                  style={{
                    display: "flex",
                    fontSize: 32,
                    fontWeight: 700,
                    color: fg,
                    background: bg,
                    borderRadius: 999,
                    padding: "10px 28px",
                  }}
                >
                  {b.label}
                </span>
              );
            })
          ) : (
            <span style={{ fontSize: 32, color: CHALK_DIM, display: "flex" }}>
              {S.highlight.ogReplayNoBadges}
            </span>
          )}
        </div>
      </div>
    ),
    size,
  );
}

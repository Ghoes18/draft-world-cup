import type { Metadata } from "next";
import { decodeHighlight } from "7a0-engine";
import { formatScenarioLabel } from "../../_data/teamDisplay";
import { getServerStrings } from "../../_i18n/server";
import { HighlightReplay } from "./HighlightReplay";

type Params = { code: string };

function tryDecode(code: string) {
  try {
    return decodeHighlight(code);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { strings: S } = await getServerStrings();
  const { code } = await params;
  const payload = tryDecode(code);
  if (!payload) {
    return { title: `${S.highlight.invalidTitle} — NINETY`, description: S.highlight.invalidBody };
  }
  const scenario = formatScenarioLabel(payload.scn[0], payload.scn[1]);
  const title = `${payload.lb[0]} ${payload.sc[0]}–${payload.sc[1]} ${payload.lb[1]} · ${scenario}`;
  const description = S.highlight.ogDescription(scenario);
  return {
    title: `${title} — NINETY`,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function HighlightPage({ params }: { params: Promise<Params> }) {
  const { strings: S } = await getServerStrings();
  const { code } = await params;
  const payload = tryDecode(code);

  if (!payload) {
    return (
      <main className="shell">
        <section className="panel" style={{ padding: "1.5rem", textAlign: "center" }}>
          <p className="eyebrow">{S.highlight.kicker}</p>
          <h1 className="panel__title">{S.highlight.invalidTitle}</h1>
          <p className="dim">{S.highlight.invalidBody}</p>
          <p style={{ marginTop: "1rem" }}>
            <a className="btn-kick" href="/">
              {S.highlight.buildYourOwn}
            </a>
          </p>
        </section>
      </main>
    );
  }

  return <HighlightReplay payload={payload} />;
}

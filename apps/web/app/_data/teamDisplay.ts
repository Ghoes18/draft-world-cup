/**
 * Team labels for draft UI — flag emoji + full World Cup year.
 * FIFA codes sourced from the Fjelstul World Cup Database team list.
 */

const TEAM_NAME_TO_FIFA: Readonly<Record<string, string>> = {
  algeria: "DZA",
  angola: "AGO",
  argentina: "ARG",
  australia: "AUS",
  austria: "AUT",
  belgium: "BEL",
  bolivia: "BOL",
  "bosnia and herzegovina": "BIH",
  brazil: "BRA",
  bulgaria: "BGR",
  cameroon: "CMR",
  canada: "CAN",
  chile: "CHL",
  china: "CHN",
  "chinese taipei": "TWN",
  colombia: "COL",
  "costa rica": "CRI",
  croatia: "HRV",
  cuba: "CUB",
  "czech republic": "CZE",
  czechoslovakia: "CSK",
  denmark: "DNK",
  "dutch east indies": "IDN",
  "east germany": "DDR",
  ecuador: "ECU",
  egypt: "EGY",
  "el salvador": "SLV",
  england: "ENG",
  "equatorial guinea": "GNQ",
  france: "FRA",
  germany: "DEU",
  ghana: "GHA",
  greece: "GRC",
  haiti: "HTI",
  honduras: "HND",
  hungary: "HUN",
  iceland: "ISL",
  iran: "IRN",
  iraq: "IRQ",
  israel: "ISR",
  italy: "ITA",
  "ivory coast": "CIV",
  jamaica: "JAM",
  japan: "JPN",
  kuwait: "KWT",
  mexico: "MEX",
  morocco: "MAR",
  netherlands: "NLD",
  "new zealand": "NZL",
  nigeria: "NGA",
  "north korea": "PRK",
  "northern ireland": "NIR",
  norway: "NOR",
  panama: "PAN",
  paraguay: "PRY",
  peru: "PER",
  poland: "POL",
  portugal: "PRT",
  qatar: "QAT",
  "republic of ireland": "IRL",
  romania: "ROU",
  russia: "RUS",
  "saudi arabia": "SAU",
  scotland: "SCO",
  senegal: "SEN",
  "serbia and montenegro": "SCG",
  serbia: "SRB",
  slovakia: "SVK",
  slovenia: "SVN",
  "south africa": "ZAF",
  "south korea": "KOR",
  "soviet union": "SUN",
  spain: "ESP",
  sweden: "SWE",
  switzerland: "CHE",
  thailand: "THA",
  togo: "TGO",
  "trinidad and tobago": "TTO",
  tunisia: "TUN",
  turkey: "TUR",
  ukraine: "UKR",
  "united arab emirates": "ARE",
  "united states": "USA",
  uruguay: "URY",
  wales: "WAL",
  "west germany": "DEU",
  yugoslavia: "YUG",
  zaire: "COD",
};

/** FIFA 3-letter code → ISO 3166-1 alpha-2 for regional-indicator flags. */
const FIFA_TO_ALPHA2: Readonly<Record<string, string>> = {
  AGO: "AO",
  ARE: "AE",
  ARG: "AR",
  AUS: "AU",
  AUT: "AT",
  BEL: "BE",
  BGR: "BG",
  BIH: "BA",
  BOL: "BO",
  BRA: "BR",
  CAN: "CA",
  CHE: "CH",
  CHL: "CL",
  CHN: "CN",
  CIV: "CI",
  CMR: "CM",
  COD: "CD",
  COL: "CO",
  CRI: "CR",
  CSK: "CZ",
  CUB: "CU",
  CZE: "CZ",
  DDR: "DE",
  DEU: "DE",
  DNK: "DK",
  DZA: "DZ",
  ECU: "EC",
  EGY: "EG",
  ENG: "GB",
  ESP: "ES",
  FRA: "FR",
  GHA: "GH",
  GNQ: "GQ",
  GRC: "GR",
  HND: "HN",
  HRV: "HR",
  HTI: "HT",
  HUN: "HU",
  IDN: "ID",
  IRL: "IE",
  IRN: "IR",
  IRQ: "IQ",
  ISL: "IS",
  ISR: "IL",
  ITA: "IT",
  JAM: "JM",
  JPN: "JP",
  KOR: "KR",
  KWT: "KW",
  MAR: "MA",
  MEX: "MX",
  NGA: "NG",
  NIR: "GB",
  NLD: "NL",
  NOR: "NO",
  NZL: "NZ",
  PAN: "PA",
  PER: "PE",
  POL: "PL",
  PRK: "KP",
  PRT: "PT",
  PRY: "PY",
  QAT: "QA",
  ROU: "RO",
  RUS: "RU",
  SAU: "SA",
  SCG: "RS",
  SCO: "GB",
  SEN: "SN",
  SLV: "SV",
  SRB: "RS",
  SUN: "RU",
  SVK: "SK",
  SVN: "SI",
  SWE: "SE",
  TGO: "TG",
  THA: "TH",
  TTO: "TT",
  TUN: "TN",
  TUR: "TR",
  TWN: "TW",
  UKR: "UA",
  URY: "UY",
  USA: "US",
  WAL: "GB",
  YUG: "RS",
  ZAF: "ZA",
};

function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function alpha2ToFlagEmoji(alpha2: string): string {
  const code = alpha2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...[...code].map((char) => 0x1f1e6 - 65 + char.charCodeAt(0)),
  );
}

export function flagEmojiForTeam(team: string): string {
  const fifa = TEAM_NAME_TO_FIFA[normalizeTeamName(team)];
  if (!fifa) return "";
  const alpha2 = FIFA_TO_ALPHA2[fifa];
  if (!alpha2) return "";
  return alpha2ToFlagEmoji(alpha2);
}

export function formatScenarioLabel(team: string, cup: number): string {
  // Captain Tsubasa easter egg — a fictional side with no real flag.
  if (normalizeTeamName(team) === "captain tsubasa") {
    return `⚽ ${team} · ${cup}`;
  }
  const flag = flagEmojiForTeam(team);
  const prefix = flag ? `${flag} ` : "";
  return `${prefix}${team} · ${cup}`;
}

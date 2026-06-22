# Squad import files

**7a0 is design inspiration** — this project builds its own catalog. No external 7a0 app to fetch from.

## Pipeline (precedence: heuristic < external CSV < curated JSON)

```bash
cd /Users/goncaloguimaraes/Desktop/programming/draft-world-cup

# 1. Full roster — career heuristic overall for all ~10k players
pnpm build:catalog

# 2. Optional — overlay external CSV ratings (below curated)
pnpm import:external --csv ./data/external-ratings.csv --overlay ./data/catalog.json

# 3. Curated squads — fine positions + tuned overall (wins on conflicts)
pnpm import:squads --dir ./squads/curated --overlay ./data/catalog.json
```

Each step writes `data/catalog.json` and `apps/web/public/catalog.json`.

## Curated overlay (`squads/curated/`)

JSON files with explicit `positions`, `positionSource: "api"`, and `overall` per player. Matched onto the Fjelstul base by **shirt number**, then **normalized name**.

Templates: `brazil-1970.json`, `argentina-1986.json`.

## External CSV (`import:external`)

Columns: `name`, `year`, `team`, `overall`, `positions` (optional, slash-separated).

Example row: `Diego Maradona,1986,Argentina,96,CAM/CF/LW`

## Heuristic base (`build:catalog`)

Fjelstul CSV signals: starts, goals (knockout/final weight), team won/reached final, career World Cup count. Produces `positionSource: "inferred"` with coarse role expansion.

## Formats

### Autoral (curated / batch)

```json
{
  "scenarios": [{
    "id": "brazil-1970",
    "team": "Brazil",
    "cup": 1970,
    "players": [{
      "name": "Pelé",
      "naturalPosition": "ST",
      "positions": ["ST", "CF", "CAM"],
      "positionSource": "api",
      "overall": 95,
      "force": 245
    }]
  }]
}
```

### Live-style (optional licensed exports)

```json
{ "sel": "Brasil", "copa": 1970, "squad": [{ "id": "x", "name": "Pelé", "pos": "PE", "f": 123, "overall": 94, "positions": ["PE", "MEI"] }] }
```

`squads/examples/` is not imported (skipped by `import:squads`).

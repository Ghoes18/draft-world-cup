# Squad import files

Place squad JSON files here, then run:

```bash
pnpm import:squads --dir ./squads --out ./data/catalog.json
```

## Supported formats

### Live 7a0 (one file per squad)

```json
{
  "sel": "Brasil",
  "copa": 1970,
  "squad": [
    { "id": "player-id", "name": "Pelé", "pos": "PE", "f": 123, "n": 10 }
  ]
}
```

The `f` field is XOR-obfuscated; the importer decodes it with `decode7a0Force`.
Only import files you are licensed to use.

### Autoral (one or more scenarios per file)

```json
{
  "scenarios": [
    {
      "id": "brazil-1970",
      "team": "Brazil",
      "cup": 1970,
      "players": [
        { "id": "br70-pele", "name": "Pelé", "naturalPosition": "ST", "force": 245, "shirtNumber": 10 }
      ]
    }
  ]
}
```

Forces are stored in clear text (0–255).

## Example

`example-brazil-1970.json` is a minimal autoral sample you can import immediately.

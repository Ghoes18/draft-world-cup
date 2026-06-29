# Captain Tsubasa easter-egg portraits

Drop one image per player here and it shows as that player's photo inside the
hidden Captain Tsubasa squad (framed in electric blue). If a file is missing,
the avatar falls back to the holographic number-card automatically.

**No images ship with the repo** — Captain Tsubasa character art is copyrighted
(© Yoichi Takahashi / Shueisha). To fetch wiki portraits locally:

```bash
pnpm import:tsubasa
```

This writes `ct-*.webp` here from the Captain Tsubasa Fandom wiki (dev use
only). Replace with art you own the rights to before any public release.

## Required filenames

Square images work best (they're cropped to a circle). Format: **`.webp`**.

| File                  | Player                |
| --------------------- | --------------------- |
| `ct-wakabayashi.webp` | Genzo Wakabayashi     |
| `ct-kaltz.webp`       | Hermann Kaltz         |
| `ct-gentile.webp`     | Salvatore Gentile     |
| `ct-misugi.webp`      | Jun Misugi            |
| `ct-tsubasa.webp`     | Tsubasa Ozora         |
| `ct-misaki.webp`      | Taro Misaki           |
| `ct-rivaul.webp`      | Rivaul                |
| `ct-natureza.webp`    | Natureza              |
| `ct-schneider.webp`   | Karl Heinz Schneider  |
| `ct-santana.webp`     | Carlos Santana        |
| `ct-hyuga.webp`       | Kojiro Hyuga          |

To change the format/path, edit `tsubasaPhotoPath()` in
`src/captainTsubasa.ts`.

# Neon Coast Cover Studio

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ted666/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/ted666/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns your photos and a caption into GTA-style poster cover art, exported as a PNG to share. Made for the [gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01) bounty on make.fun.

## What it does

- **Six layouts** — Hero + Three, Four Panel Grid, Nine Panel Grid, Tilted Snapshots, Full Bleed, Split Diptych — each adapting to square, portrait and wide covers.
- **Five colour grades** — Sunset, Neon Nights, Golden Hour, Noir, Palm Teal — painted over each photo with a soft vignette.
- **Any photo** — add your own photos from your machine (they never leave it), or use the two bundled samples. Fill several panels with one photo or several, crop and position each panel by dragging, zoom with the wheel or the slider.
- **Bold lettering** — a halftone title band with a big condensed title, a script subtitle and a badge, in the free SIL Open Font License fonts Anton and Pacifico (vendored under `app/fonts/`).
- **Fast and easy** — one click exports the cover as a PNG in 1080 x 1080, 1080 x 1350 or 1920 x 1080. Undo and redo included.
- **Fully offline** — static files under `app/`, no network request, no upload.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

## Build the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE). The fonts under `app/fonts/` are licensed under the SIL Open Font License 1.1 (their OFL texts sit beside them). The sample photos under `app/samples/` were made with an image model for make.fun and are free to use.

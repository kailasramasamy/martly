# Store pack rendering (spike)

Stores pack their own staples in clear pouches printed with their artwork. Instead of a product per store, each product gets one AI photo of a blank clear pouch, and the store's transparent front/back artwork is printed onto it at render time.

- `build.py` — sample Harur Fresh Mart artwork (front + back) and `zones.json` (areas filled per product: name, weight, MRP, FSSAI…). Outputs `*-artwork` (what a store uploads), `*-guide` (zones outlined), `*-filled` (artwork + sample text).
- `templates.json` — one entry per pouch photo: print area, bag outline, curvature. `pillow-1kg` is the chosen pack (crimped band seals top and bottom); `standup-1kg` is the earlier try.
- `compose.mjs` — prints artwork onto the photo with `sharp`: clip to the outline, cylinder-curve warp, photo lighting, film gloss over the ink. No AI touches the artwork.
- `ai/` — base photos (`gpt-image-2.5-flare`, medium) and the request bodies.

```sh
python3 build.py "$PWD/out-pillow" "$PWD/logo.png" 1528   # canvas height matches the template's print area
node compose.mjs pillow-1kg out-pillow/front-filled.png out-pillow/render-front.png
magick ai/pillow-toor-dal.png -flop ai/pillow-toor-dal-back.png
node compose.mjs pillow-1kg out-pillow/back-filled.png out-pillow/render-back.png ai/pillow-toor-dal-back.png
```

Open items: replace the sample with a real store's artwork; generate other products from the same pouch photo and check the geometry stays identical; a real back photo instead of the mirrored front.

## Sree Ranga (first real store)

`sreeranga/` redraws their toor dal pack from photos (`photo-front.png`, `photo-back.png`). It's printed edge to edge, so it uses the `pillow-1kg-full` template, where the print area is the whole bag face. `mandala.png` is an AI-drawn stand-in for their floral line art.

```sh
python3 sreeranga/build.py "$PWD/sreeranga/out"
node compose.mjs pillow-1kg-full sreeranga/out/front-filled.png sreeranga/out/render-front.png
node compose.mjs pillow-1kg-full sreeranga/out/back-filled.png sreeranga/out/render-back.png ai/pillow-toor-dal-back.png
```

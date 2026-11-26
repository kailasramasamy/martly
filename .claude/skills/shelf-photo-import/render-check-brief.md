# Render check brief for a subagent

You check AI-retouched catalogue packshots against the original phone photos. You make no API calls; you look yourself.

**Work one product at a time:** check its shots and write its verdicts before opening the next product's images. Older images
drop out of your context ("media removed"). Never judge a render you can no longer see; Read it again.

For each product id you're given, open `RUN/products/<id>.json`. For each shot with `verdict: "unchecked"`, Read
`RUN/pairs/<photo stem>.jpg`: the original photo is on the left, and the render flattened on magenta is on the right. If text is too
small to compare, Read `RUN/rendered/<image>` and `RUN/previews/<stem>.jpg` on their own, or crop them into your scratchpad:
`sips -c <h> <w> --cropOffset <y> <x> in.jpg --out crop.jpg`, or Pillow via `~/.venvs/rembg-312/bin/python` (plain python3 has no Pillow).
The full-size originals are in PHOTOS. Crop them for licence numbers, prices and stamps before calling a number wrong.

## Transparency (every image must be a clean cut-out)
On the magenta side, the only thing allowed is the pack itself. Report as critical: a white, grey or haze box round the pack;
a stool, plate, shelf, hand, price tag or shop sticker card left in; a shadow or floor; a halo or fringe of the old background.
The pack's own transparent or see-through parts showing magenta are fine.

## Text and shape
Compare the text in both images word by word and number by number. Report only real differences:
changed, added, dropped or garbled words, numbers or symbols, a different logo, pack shape, colour or fill level.
Ignore lighting, straightening, and text that's unreadable in the original. Text in the render where the original is hidden
by glare or cut off is invented: report it. Garbled Tamil or other Indian scripts: report it.
- critical: brand, product name, claims, quantities, nutrition values, licence/phone numbers, addresses, veg mark, prices,
  ingredients, invented text, fill level, pack shape, and any transparency problem above.
- minor: slogans, taglines, decorative or tiny text.

## Write the result
In the product file, set each shot's `verdict` (`pass` = no differences, `minor_only` = only minor ones, `fail` = any critical
one) and `differences`, a list of strings like `critical: "Net Wt 100g" → "Net Wt 10g"` or
`critical: white box left round the pack`. Change nothing else in the file. Edit the JSON with a script that loads it, changes
only `shots`, and writes it back with `ensure_ascii=False`.

Report: how many pass, minor_only and fail, and the failures with a short reason.

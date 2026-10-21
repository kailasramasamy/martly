# Builds assets/fonts/MartlyTamil-*.ttf: Noto Sans Tamil with Manrope's digits, so numbers in the Tamil UI match English.
# Tamil text renders 10% smaller (TAMIL_FONT_SCALE in lib/font-patch.ts), so the digits are drawn 1/0.9 larger to cancel it.
# Run from apps/mobile after `pip install fonttools`: python3 scripts/build-tamil-fonts.py

from pathlib import Path

from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

FONTS = Path(__file__).resolve().parents[3] / "node_modules" / "@expo-google-fonts"
OUT = Path(__file__).resolve().parents[1] / "assets" / "fonts"
WEIGHTS = ["400Regular", "500Medium", "600SemiBold", "700Bold", "800ExtraBold"]
TAMIL_FONT_SCALE = 0.9
FAMILY = "Martly Tamil"


def swap_digits(tamil: TTFont, manrope: TTFont) -> None:
    scale = tamil["head"].unitsPerEm / manrope["head"].unitsPerEm / TAMIL_FONT_SCALE
    src_glyphs, src_cmap = manrope.getGlyphSet(), manrope.getBestCmap()
    cmap = tamil.getBestCmap()
    for digit in "0123456789":
        name = cmap[ord(digit)]
        pen = TTGlyphPen(None)
        src_glyphs[src_cmap[ord(digit)]].draw(TransformPen(pen, (scale, 0, 0, scale, 0, 0)))
        glyph = pen.glyph()
        glyph.recalcBounds(tamil["glyf"])
        tamil["glyf"][name] = glyph
        width = round(src_glyphs[src_cmap[ord(digit)]].width * scale)
        tamil["hmtx"][name] = (width, glyph.xMin if glyph.numberOfContours else 0)


# OFL: a modified font must not keep the original family name
def rename(font: TTFont, style: str) -> None:
    postscript = f"{FAMILY.replace(' ', '')}-{style}"
    names = font["name"]
    for record in list(names.names):
        if record.nameID in (1, 3, 4, 6, 16, 17):
            names.removeNames(nameID=record.nameID)
    names.setName(FAMILY if style in ("Regular", "Bold") else f"{FAMILY} {style}", 1, 3, 1, 0x409)
    names.setName(f"{FAMILY} {style}", 4, 3, 1, 0x409)
    names.setName(postscript, 3, 3, 1, 0x409)
    names.setName(postscript, 6, 3, 1, 0x409)
    names.setName(FAMILY, 16, 3, 1, 0x409)
    names.setName(style, 17, 3, 1, 0x409)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for weight in WEIGHTS:
        style = weight.lstrip("0123456789")
        tamil = TTFont(FONTS / "noto-sans-tamil" / weight / f"NotoSansTamil_{weight}.ttf")
        manrope = TTFont(FONTS / "manrope" / weight / f"Manrope_{weight}.ttf")
        swap_digits(tamil, manrope)
        rename(tamil, style)
        tamil.save(OUT / f"MartlyTamil-{style}.ttf")
        print(f"wrote MartlyTamil-{style}.ttf")


main()

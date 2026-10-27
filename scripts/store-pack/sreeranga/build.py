"""Sree Ranga 1kg pillow pack artwork (front + back), redrawn from photos of their toor dal pack.

usage: python3 build.py <out_dir>
Renders per side: *-artwork (what the store would upload), *-guide (zones outlined),
*-filled (artwork + sample text, fed to compose.mjs) and *-preview (filled over a dal fill).
"""
import base64, json, random, subprocess, sys
from pathlib import Path

HERE = Path(__file__).parent
OUT = Path(sys.argv[1])
# Printed edge to edge: the canvas bleeds PAD past the 1000-wide layout on each side
W, H, PAD = 1000, 1528, 126
L, R, FW = -PAD, W + PAD, W + 2 * PAD
LIME, LIME_DARK, ORANGE, RED, INK = "#86c440", "#5a9e1f", "#f5a524", "#c8102e", "#1f2937"
EN = "font-family:Poppins"
SERIF = "font-family:'Times New Roman'"
TA = "font-family:'Noto Sans Tamil'"
SCRIPT = "font-family:'Snell Roundhand'"


def data_uri(name):
    return "data:image/png;base64," + base64.b64encode((HERE / name).read_bytes()).decode()


ZONES = {
    "front": {
        "nameTa": {"x": 290, "y": 40, "w": 420, "h": 80},
        "netWeight": {"x": 52, "y": 540, "w": 96, "h": 60},
    },
    "back": {
        "netQuantity": {"x": 760, "y": 92, "w": 170, "h": 42},
        "nameEn": {"x": 150, "y": 1352, "w": 220, "h": 44},
        "ingredients": {"x": 745, "y": 1162, "w": 200, "h": 40},
        "nutrition": {"x": 560, "y": 1222, "w": 380, "h": 250},
    },
}

SAMPLE = {
    "nameTa": "துவரம் பருப்பு", "netWeight": "1 Kg", "netQuantity": "1 Kg",
    "nameEn": "Toor Dal", "ingredients": "Toor Dal",
    "nutrition": [("Energy", "343 kcal"), ("Carbohydrate", "48.2 gm"), ("Protein", "18.8 gm"),
                  ("Dietary Fibre", "15.0 gm"), ("Fat", "1.5 gm")],
}


def text(x, y, s, size, fill, font=EN, weight=400, anchor="start", extra=""):
    return (f'<text x="{x}" y="{y}" style="{font};font-size:{size}px;font-weight:{weight}" '
            f'fill="{fill}" text-anchor="{anchor}" {extra}>{s}</text>')


DEFS = f"""<defs>
<linearGradient id="lime" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9bd14f"/><stop offset="1" stop-color="{LIME_DARK}"/></linearGradient>
<linearGradient id="label" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f59e0b"/><stop offset=".5" stop-color="#fcd34d"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
<linearGradient id="peach" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fde3b5"/><stop offset="1" stop-color="#f7b45a"/></linearGradient>
<linearGradient id="corner" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdf0b8"/><stop offset="1" stop-color="#f7bf5e"/></linearGradient>
<clipPath id="lower"><rect x="{L}" y="956" width="{FW}" height="{H - 956}"/></clipPath>
</defs>"""

def scroll(x, flip):
    s = -1 if flip else 1
    return (f'<path d="M{x},50 c{-26 * s},-6 {-40 * s},14 {-28 * s},30 c{10 * s},12 {28 * s},4 {22 * s},-8 '
            f'M{x},110 c{-26 * s},6 {-40 * s},-14 {-28 * s},-30" fill="none" stroke="#fff" stroke-width="5" '
            f'stroke-linecap="round"/>')


def front_top():
    out = f'<path d="M{L},0 H{R} V58 C760,74 300,50 {L},70 Z" fill="url(#lime)"/>'
    out += f'<path d="M{L},70 C300,50 520,62 640,60 L640,72 C500,74 300,64 {L},84 Z" fill="{ORANGE}"/>'
    out += f'<path d="M{R},58 C980,90 950,160 985,300 C1010,420 990,560 955,640 L{R},620 Z" fill="url(#peach)"/>'
    out += f'<rect x="270" y="30" width="460" height="100" rx="18" fill="url(#label)" stroke="#fff" stroke-width="5"/>'
    out += scroll(268, False) + scroll(732, True)
    out += (f'<path d="M{L},470 H150 L178,525 V615 L150,670 H{L} Z" fill="#fff" stroke="{ORANGE}" stroke-width="7"/>')
    out += text(100, 528, "Net.Wt.", 22, INK, EN, 600, "middle")
    return out


def hygienic():
    # Yellow corner triangle edged by a white stripe, as printed on the pack
    out = f'<path d="M515,718 L{R},452 V718 Z" fill="#fff"/>'
    out += f'<path d="M560,718 L{R},478 V718 Z" fill="url(#corner)"/>'
    out += text(842, 662, "Hygienic &amp;", 34, RED, SCRIPT, 700, "middle")
    out += text(858, 706, "Healthy", 38, RED, SCRIPT, 700, "middle")
    for x, y, r in ((748, 668, -25), (775, 704, 30)):
        out += f'<path d="M0,0 C8,-10 22,-10 26,0 C22,10 8,10 0,0 Z" fill="{RED}" transform="translate({x},{y}) rotate({r})"/>'
    return out


def front():
    out = front_top() + hygienic()
    out += f'<rect x="{L}" y="718" width="{FW}" height="240" fill="url(#lime)"/>'
    out += f'<g clip-path="url(#lower)"><rect x="{L}" y="956" width="{FW}" height="{H - 956}" fill="#f7f7f5"/>'
    out += f'<image href="{data_uri("mandala.png")}" x="{L}" y="940" width="900" height="600" preserveAspectRatio="xMidYMid slice"/>'
    out += f'<path d="M640,956 H{R} V{H} H330 Z" fill="{LIME}"/>'
    out += f'<path d="M700,956 H742 L432,{H} H390 Z" fill="#f3e3b3"/></g>'
    return out + f'<image href="{data_uri("logo.png")}" x="190" y="1115" width="560" height="315"/>'


BRANCHES = [
    (["Opp. S.P. Office, Collectorate,", "Dharmapuri - 636 705."], "12415005000013"),
    (["Bye Pass Road,", "Palacode - 636 808."], "12421005000458"),
    (["Dharmapuri Main Road,", "BDO Office Bus Stop,", "Pennagaram - 636 809."], "12421005000498"),
]
LABEL_ROWS = ["Net Qty", "M.R.P. Rs.", "Batch No.", "Packed on", "Use by Date"]


def back_top():
    out = f'<rect x="{L}" y="0" width="{FW}" height="40" fill="url(#lime)"/>'
    out += f'<rect x="{L}" y="40" width="{FW}" height="12" fill="{ORANGE}"/>'
    out += f'<rect x="30" y="60" width="430" height="420" rx="18" fill="#fff"/>'
    out += text(60, 105, "Branches", 26, INK, EN, 600)
    y = 145
    for lines, fssai in BRANCHES:
        for line in lines + [f"Fssai No : {fssai}"]:
            out += text(60, y, line, 22, INK)
            y += 29
        y += 14
    out += f'<rect x="530" y="60" width="440" height="420" rx="18" fill="#fff"/>'
    out += f'<rect x="555" y="80" width="390" height="290" rx="16" fill="none" stroke="{INK}" stroke-width="3"/>'
    for i, label in enumerate(LABEL_ROWS):
        y = 122 + i * 50
        out += text(575, y, label, 26, INK, EN, 500) + text(745, y, ":", 26, INK, EN, 500)
    out += text(575, 196, "(Inclusive of all Taxes)", 15, INK)
    return out


def tree(cx):
    canopy = "".join(f'<circle cx="{cx + dx}" cy="{cy}" r="{r}"/>' for dx, cy, r in
                     ((0, 556, 22), (-22, 566, 16), (22, 566, 16), (-14, 544, 15), (14, 544, 15), (0, 536, 14)))
    branches = (f"M{cx},590 V546 M{cx},578 L{cx - 16},562 M{cx},570 L{cx + 17},554 "
                f"M{cx - 9},569 L{cx - 18},556 M{cx},556 L{cx - 9},545")
    roots = (f"M{cx},612 C{cx - 4},620 {cx - 18},622 {cx - 26},624 M{cx},612 C{cx + 4},620 {cx + 18},622 {cx + 26},624 "
             f"M{cx},614 C{cx - 2},620 {cx - 6},624 {cx - 10},628 M{cx},614 C{cx + 2},620 {cx + 6},624 {cx + 10},628")
    out = f'<g fill="{INK}">{canopy}<path d="M{cx - 6},614 C{cx - 3},600 {cx - 4},590 {cx - 8},578 H{cx + 8} C{cx + 4},590 {cx + 3},600 {cx + 6},614 Z"/></g>'
    out += f'<path d="{roots}" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>'
    return out + f'<path d="{branches}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>'


def eco_icons():
    out = ""
    for cx, l1, l2 in ((600, "Save Trees,", "Save Rain"), (750, "Recyclable", ""), (900, "Keep Your", "City Clean")):
        out += text(cx, 650, l1, 18, INK, EN, 500, "middle") + text(cx, 672, l2, 18, INK, EN, 500, "middle")
    out += tree(600)
    out += text(750, 622, "&#x267B;", 76, INK, "font-family:'Apple Symbols'", 400, "middle")
    out += (f'<g fill="{INK}"><path d="M915,585 h28 l-4,40 h-20 Z"/><circle cx="880" cy="560" r="8"/>'
            f'<path d="M874,572 h12 l14,26 -6,4 -8,-12 v38 h-8 v-20 l-6,20 h-8 l6,-30 -8,8 -6,-4 Z"/></g>')
    return f'<g transform="translate(-25,0)">{out}</g>'


def nutrition_table():
    z = ZONES["back"]["nutrition"]
    out = f'<rect x="{z["x"]}" y="{z["y"]}" width="{z["w"]}" height="{z["h"]}" fill="none" stroke="{INK}" stroke-width="3"/>'
    out += text(z["x"] + z["w"] / 2, z["y"] + 34, "NUTRITIONAL FACTS", 24, INK, EN, 700, "middle")
    out += text(z["x"] + z["w"] / 2, z["y"] + 60, "(Approx 100 gm product)", 18, INK, EN, 400, "middle")
    out += f'<line x1="{z["x"]}" x2="{z["x"] + z["w"]}" y1="{z["y"] + 72}" y2="{z["y"] + 72}" stroke="{INK}" stroke-width="2"/>'
    return out + f'<line x1="790" x2="790" y1="{z["y"] + 72}" y2="{z["y"] + z["h"]}" stroke="{INK}" stroke-width="2"/>'


def back():
    out = back_top() + eco_icons()
    out += f'<rect x="{L}" y="718" width="{FW}" height="410" fill="url(#lime)"/>'
    out += f'<rect x="{L}" y="1128" width="{FW}" height="{H - 1128}" fill="url(#lime)"/>'
    out += f'<rect x="30" y="1128" width="430" height="370" rx="18" fill="#fff"/>'
    out += f'<image href="{data_uri("logo.png")}" x="70" y="1140" width="350" height="197"/>'
    out += f'<rect x="140" y="1350" width="240" height="48" rx="24" fill="{ORANGE}"/>'
    out += text(245, 1438, "SREE RANGA DEPARTMENT STORES", 22, INK, EN, 700, "middle")
    out += text(245, 1470, "20, Nethaji Bye Pass Road, Dharmapuri.", 20, INK, EN, 400, "middle")
    out += f'<rect x="530" y="1128" width="440" height="370" rx="18" fill="#fff"/>'
    out += text(560, 1192, "Ingredient :", 26, INK, EN, 500)
    return out + nutrition_table()


def guide(side):
    out = ""
    style = 'fill="none" stroke="#db2777" stroke-width="4" stroke-dasharray="14 8"'
    for key, z in ZONES[side].items():
        out += f'<rect x="{z["x"]}" y="{z["y"]}" width="{z["w"]}" height="{z["h"]}" {style}/>'
        out += text(z["x"] + 6, z["y"] + 20, key, 16, "#db2777", EN, 600)
    return out


def sample(side):
    if side == "front":
        return (text(500, 100, SAMPLE["nameTa"], 52, RED, TA, 700, "middle")
                + text(100, 585, SAMPLE["netWeight"], 34, INK, EN, 700, "middle"))
    out = text(770, 122, SAMPLE["netQuantity"], 26, INK, EN, 600)
    out += text(260, 1384, SAMPLE["nameEn"], 26, "#fff", EN, 700, "middle")
    out += text(752, 1192, SAMPLE["ingredients"], 26, INK, "font-family:Poppins;font-style:italic", 500)
    for i, (k, v) in enumerate(SAMPLE["nutrition"]):
        y = 1328 + i * 34
        out += text(575, y, k, 22, INK) + text(805, y, v, 22, INK)
    return out


def render(name, inner, under=""):
    svg = OUT / f"{name}.svg"
    svg.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{FW}" height="{H}" '
                   f'viewBox="{L} 0 {FW} {H}">{DEFS}{under}{inner}</svg>')
    subprocess.run(["node", str(HERE.parent / "svg2png.mjs"), str(svg), f"{OUT / name}.png"],
                   check=True, capture_output=True)
    svg.unlink()


def dal_fill():
    rng = random.Random(7)
    out = f'<rect x="{L}" width="{FW}" height="{H}" fill="#c98f22"/>'
    for _ in range(11000):
        x, y, rx = rng.uniform(L - 10, R + 10), rng.uniform(-10, H + 10), rng.uniform(9, 13)
        tone = rng.choice(["#f2c14e", "#e9b23b", "#f6cd62", "#dca02c", "#f0bb45"])
        out += (f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{rx:.1f}" ry="{rx * rng.uniform(0.6, 0.95):.1f}" '
                f'transform="rotate({rng.randint(0, 179)} {x:.0f} {y:.0f})" fill="{tone}" '
                f'stroke="#b97f1c" stroke-width="1.2"/>')
    return out


OUT.mkdir(parents=True, exist_ok=True)
fill = dal_fill()
for side, art in (("front", front()), ("back", back())):
    render(f"{side}-artwork", art)
    render(f"{side}-guide", art + guide(side))
    render(f"{side}-filled", art + sample(side))
    render(f"{side}-preview", art + sample(side), fill)
(OUT / "zones.json").write_text(json.dumps({"canvas": {"x": L, "w": FW, "h": H}, **ZONES}, indent=2))

"""Sample 1kg stand-up pouch artwork for Harur Fresh Mart (front + back).

Renders three variants per side:
  clean   - the artwork a store would upload (transparent window)
  guide   - clean + dashed boxes over the zones Martly fills at render time
  preview - clean + sample contents in the window + sample variable text
"""
import base64, json, random, subprocess, sys
from pathlib import Path

OUT = Path(sys.argv[1])
LOGO = "data:image/png;base64," + base64.b64encode(Path(sys.argv[2]).read_bytes()).decode()
# Canvas matches the pouch template face (argv[3] = height); everything below the clear middle sits DROP lower
W, H = 1000, int(sys.argv[3]) if len(sys.argv) > 3 else 1690
DROP = H - 1400
GREEN, DARK, AMBER = "#15803d", "#14532d", "#f59e0b"
EN = "font-family:Poppins"
TA = "font-family:'Tamil Sangam MN'"

ZONES = {
    "front": {
        "nameEn": {"x": 150, "y": 985 + DROP, "w": 600, "h": 85},
        "nameTa": {"x": 150, "y": 1070 + DROP, "w": 600, "h": 60},
        "netWeight": {"cx": 820, "cy": 955 + DROP, "r": 62},
    },
    "back": {
        "product": {"x": 500, "y": 300, "w": 400, "h": 70},
        "netQuantity": {"x": 500, "y": 375, "w": 400, "h": 70},
        "mrp": {"x": 500, "y": 450, "w": 400, "h": 70},
        "unitSalePrice": {"x": 500, "y": 525, "w": 400, "h": 70},
        "fssai": {"x": 330, "y": 1298 + DROP, "w": 400, "h": 36},
        "customerCare": {"x": 330, "y": 1342 + DROP, "w": 400, "h": 36},
    },
}

SAMPLE = {
    "nameEn": "Toor Dal", "nameTa": "துவரம் பருப்பு", "netWeight": "1 kg",
    "product": "Toor Dal (Unpolished)", "netQuantity": "1 kg",
    "mrp": "₹168.00", "unitSalePrice": "₹0.17 / g",
    "fssai": "12422999000123", "customerCare": "+91 94430 00000",
}


def text(x, y, s, size, fill, font=EN, weight=400, anchor="start"):
    return (f'<text x="{x}" y="{y}" style="{font};font-size:{size}px;font-weight:{weight}" '
            f'fill="{fill}" text-anchor="{anchor}">{s}</text>')


def lower(inner):
    return f'<g transform="translate(0,{DROP})">{inner}</g>'


def front():
    body = f'<rect x="230" y="150" width="540" height="300" rx="28" fill="#fff"/>'
    body += f'<image href="{LOGO}" x="270" y="165" width="460" height="230"/>'
    body += text(500, 425, "அரூர் ஃப்ரெஷ் மார்ட்", 30, DARK, TA, 700, "middle")
    low = f'<rect x="120" y="960" width="760" height="190" rx="24" fill="#fff" stroke="{GREEN}" stroke-width="6"/>'
    low += f'<circle cx="820" cy="955" r="78" fill="{AMBER}" stroke="#fff" stroke-width="8"/>'
    low += text(820, 920, "NET WT", 20, DARK, EN, 600, "middle")
    low += f'<path fill="{GREEN}" d="M0,1225 C250,1185 750,1265 1000,1210 V1400 H0 Z"/>'
    low += text(500, 1295, "Cleaned · Sorted · Packed fresh in Harur", 30, "#fff", EN, 600, "middle")
    low += text(500, 1345, "சுத்தம் செய்து, தரம் பிரித்து அரூரில் பேக் செய்யப்பட்டது", 24, "#dcfce7", TA, 400, "middle")
    return body + lower(low)


BACK_ROWS = [
    ("Product", "பொருள்"), ("Net Quantity", "நிகர அளவு"),
    ("MRP (incl. of all taxes)", "அதிகபட்ச விலை"), ("Unit sale price", "அலகு விலை"),
    ("Packed on / Best before", "பேக் தேதி / பயன்படுத்த"), ("Country of origin", "தயாரிப்பு நாடு"),
]
BACK_FIXED = {4: "See batch sticker", 5: "India"}


def back():
    body = f'<rect x="40" y="110" width="920" height="1010" rx="28" fill="#fff"/>'
    body += f'<image href="{LOGO}" x="70" y="80" width="320" height="160"/>'
    body += text(420, 145, "Fresh stock every morning,", 28, DARK, EN, 600)
    body += text(420, 182, "right by the bus stand", 28, DARK, EN, 600)
    body += text(420, 222, "பேருந்து நிலையம் அருகே, தினமும் புதிய சரக்கு", 21, GREEN, TA)
    body += f'<rect x="70" y="285" width="860" height="465" rx="20" fill="#fff" stroke="{GREEN}" stroke-width="3"/>'
    for i, (en, ta) in enumerate(BACK_ROWS):
        y = 300 + i * 75
        if i:
            body += f'<line x1="90" x2="910" y1="{y}" y2="{y}" stroke="#d9e7dc" stroke-width="2"/>'
        body += text(100, y + 34, en, 24, DARK, EN, 600)
        body += text(100, y + 62, ta, 19, "#64748b", TA)
        if i in BACK_FIXED:
            body += text(510, y + 45, BACK_FIXED[i], 24, DARK, EN, 500)
    body += text(70, 805, "Storage", 26, DARK, EN, 700)
    body += text(70, 845, "Store in a cool, dry place. Move to an", 22, "#334155")
    body += text(70, 877, "airtight container after opening.", 22, "#334155")
    body += text(70, 920, "குளிர்ந்த, உலர்ந்த இடத்தில் வைக்கவும்.", 20, "#64748b", TA)
    body += text(70, 950, "திறந்த பின் காற்றுப்புகாத டப்பாவில் வைக்கவும்.", 20, "#64748b", TA)
    body += f'<rect x="640" y="785" width="290" height="190" rx="14" fill="#fff" stroke="#cbd5e1" stroke-width="2"/>'
    body += text(785, 960, "batch sticker", 16, "#94a3b8", EN, 400, "middle")
    body += f'<rect x="70" y="1000" width="44" height="44" fill="#fff" stroke="{GREEN}" stroke-width="4"/>'
    body += f'<circle cx="92" cy="1022" r="11" fill="{GREEN}"/>'
    body += text(130, 1032, "Pure vegetarian  ·  No added colour or polish", 22, DARK, EN, 500)
    low = f'<path fill="{GREEN}" d="M0,1150 C300,1110 700,1180 1000,1135 V1400 H0 Z"/>'
    low += text(70, 1210, "Packed &amp; Marketed by", 22, "#bbf7d0", EN, 500)
    low += text(70, 1248, "Harur Fresh Mart", 32, "#fff", EN, 700)
    low += text(70, 1282, "Main Road, Harur Taluk, Dharmapuri, Tamil Nadu", 22, "#fff")
    low += text(70, 1326, "FSSAI Lic. No.", 22, "#bbf7d0", EN, 500)
    low += text(70, 1370, "Customer care", 22, "#bbf7d0", EN, 500)
    return body + lower(low)


def guide(side):
    out = ""
    for key, z in ZONES[side].items():
        style = 'fill="none" stroke="#db2777" stroke-width="4" stroke-dasharray="14 8"'
        if "r" in z:
            out += f'<circle cx="{z["cx"]}" cy="{z["cy"]}" r="{z["r"]}" {style}/>'
        else:
            out += f'<rect x="{z["x"]}" y="{z["y"]}" width="{z["w"]}" height="{z["h"]}" {style}/>'
            out += text(z["x"] + 8, z["y"] + 22, key, 18, "#db2777", EN, 600)
    return out


def sample(side):
    if side == "front":
        return lower(text(450, 1048, SAMPLE["nameEn"], 64, DARK, EN, 700, "middle")
                     + text(450, 1110, SAMPLE["nameTa"], 40, GREEN, TA, 700, "middle")
                     + text(820, 978, SAMPLE["netWeight"], 40, DARK, EN, 700, "middle"))
    out = ""
    for key in ("product", "netQuantity", "mrp", "unitSalePrice"):
        z = ZONES["back"][key]
        out += text(z["x"] + 10, z["y"] + 45, SAMPLE[key], 26, DARK, EN, 700)
    for key in ("fssai", "customerCare"):
        z = ZONES["back"][key]
        out += text(z["x"], z["y"] + 28, SAMPLE[key], 24, "#fff", EN, 600)
    return out


def render(name, inner, under=""):
    svg = OUT / f"{name}.svg"
    svg.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
                   f'viewBox="0 0 {W} {H}">{under}{inner}</svg>')
    subprocess.run(["node", str(Path(__file__).parent / "svg2png.mjs"), str(svg), f"{OUT / name}.png"],
                   check=True, capture_output=True)
    svg.unlink()


def dal_fill():
    rng = random.Random(7)
    out = f'<rect width="{W}" height="{H}" fill="#c98f22"/>'
    for _ in range(12000):
        x, y = rng.uniform(-10, W + 10), rng.uniform(-10, H + 10)
        rx = rng.uniform(9, 13)
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
    render(f"{side}-preview", art + sample(side), fill)
    render(f"{side}-filled", art + sample(side))
(OUT / "zones.json").write_text(json.dumps({"canvas": {"w": W, "h": H}, **ZONES}, indent=2))

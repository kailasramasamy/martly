"""Render the Martly business card (front + back) to PDF via headless Chrome."""
import base64
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
BRANDING = HERE.parent.parent / "apps/mobile/assets/branding"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

WORDMARK = re.search(r'<path d="([^"]+)"', (BRANDING / "martly-wordmark-dark.svg").read_text()).group(1)
QR = (HERE / "qr.svg").read_text().replace("<svg ", '<svg class="qr" ', 1)


def logo(cls, text, smile):
    return (f'<svg class="{cls}" viewBox="-4 -78 371.1 149.69"><path d="{WORDMARK}" fill="{text}"/>'
            f'<path d="M14 32q114 60 228 0" fill="none" stroke="{smile}" stroke-width="15.6" stroke-linecap="round"/></svg>')


ICONS = {
    "phone": '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    "globe": '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    "pin": '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
}


def icon(name):
    return (f'<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
            f'stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</svg></span>')


def pattern():
    tiles = []
    for row in range(-1, 11):
        for col in range(-1, 7):
            x = col * 74 + (37 if row % 2 else 0)
            tiles.append(f'<g transform="translate({x} {row * 24})">{logo("", "#117d74", "#117d74")}</g>')
    body = "".join(t.replace('<svg class=""', '<svg width="40" height="16.1"') for t in tiles)
    return f'<svg width="100%" height="100%" viewBox="0 0 336 192">{body}</svg>'


html = (HERE / "card.template.html").read_text()
html = (html.replace("{{LOGO_TEAL}}", logo("logo", "#0f766e", "#fbbf24"))
            .replace("{{LOGO_WHITE}}", logo("logo", "#ffffff", "#fbbf24"))
            .replace("{{PATTERN}}", pattern())
            .replace("{{QR}}", QR))
for font in (HERE / "fonts").glob("*.ttf"):
    data = base64.b64encode(font.read_bytes()).decode()
    html = html.replace(f"fonts/{font.name}", f"data:font/ttf;base64,{data}")
for name in ICONS:
    html = html.replace(f"{{{{IC_{name.upper()}}}}}", icon(name))
PEOPLE = {
    "kailas": {"NAME": "Kailas Ramasamy", "ROLE": "Co-founder", "PHONE": "+91 89718 05878", "EMAIL": "kailas@quartex.in"},
    "boopathi": {"NAME": "Boopathi Ramasamy", "ROLE": "Co-founder", "PHONE": "+91 99021 78682", "EMAIL": "boopathi@quartex.in"},
}

for slug, fields in PEOPLE.items():
    page = html
    for key, value in fields.items():
        page = page.replace(f"{{{{{key}}}}}", value)
    source = HERE / f"card-{slug}.html"
    source.write_text(page)
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={HERE / f'martly-business-card-{slug}.pdf'}", str(source)],
                   check=True, stderr=subprocess.DEVNULL)

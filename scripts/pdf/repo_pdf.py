"""Render every tracked text file in the repo into one paginated PDF."""
import subprocess, os, sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "Second-Skool-Source.pdf")

SKIP_EXT = {".png", ".jpg", ".jpeg", ".ico", ".webp", ".woff", ".woff2", ".pdf"}
SKIP_FILES = {"package-lock.json"}

files = subprocess.run(["git", "-C", ROOT, "ls-files"], capture_output=True, text=True).stdout.split("\n")
files = [f.strip() for f in files if f.strip()]
files = [f for f in files
         if os.path.splitext(f)[1].lower() not in SKIP_EXT
         and os.path.basename(f) not in SKIP_FILES]

W, H = A4
LEFT, TOP, BOTTOM = 14 * mm, H - 16 * mm, 14 * mm
FS, LH = 6.6, 8.2
MAXCH = 118


def wrap(line):
    line = line.replace("\t", "    ").rstrip()
    if not line:
        return [""]
    out = []
    while len(line) > MAXCH:
        out.append(line[:MAXCH])
        line = "    " + line[MAXCH:]
    out.append(line)
    return out


c = canvas.Canvas(OUT, pagesize=A4)
c.setTitle("Second Skool - Full Source")
c.setAuthor("Arnav Hendre")
page = 1
toc = []


def footer():
    c.setFont("Helvetica", 6.5)
    c.setFillColorRGB(0.55, 0.55, 0.6)
    c.drawRightString(W - 14 * mm, 8 * mm, str(page))
    c.setFillColorRGB(0, 0, 0)


# cover
c.setFont("Helvetica-Bold", 26)
c.drawString(LEFT, H / 2 + 30, "Second Skool")
c.setFont("Helvetica", 12)
c.setFillColorRGB(0.4, 0.4, 0.45)
c.drawString(LEFT, H / 2 + 8, "Complete source listing")
c.setFont("Helvetica", 9)
c.drawString(LEFT, H / 2 - 14, "%d files - generated from git ls-files" % len(files))
c.setFillColorRGB(0, 0, 0)
c.showPage()
page += 1

y = TOP
for path in files:
    full = os.path.join(ROOT, path.replace("/", os.sep))
    try:
        text = open(full, encoding="utf-8", errors="replace").read()
    except Exception as e:
        text = "<<unreadable: %s>>" % e
    lines = text.split("\n")

    if y < TOP - 4:
        footer(); c.showPage(); page += 1; y = TOP
    toc.append((path, page, len(lines)))

    c.setFillColorRGB(0.07, 0.09, 0.13)
    c.rect(LEFT - 3, y - 3, W - 2 * LEFT + 6, 12, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(LEFT + 1, y, path)
    c.drawRightString(W - LEFT - 1, y, "%d lines" % len(lines))
    c.setFillColorRGB(0, 0, 0)
    y -= LH * 2.4

    n = 0
    for raw in lines:
        n += 1
        for i, seg in enumerate(wrap(raw)):
            if y < BOTTOM:
                footer(); c.showPage(); page += 1; y = TOP
            c.setFont("Courier", FS)
            c.setFillColorRGB(0.65, 0.66, 0.7)
            c.drawRightString(LEFT + 16, y, str(n) if i == 0 else "")
            c.setFillColorRGB(0.1, 0.11, 0.14)
            c.drawString(LEFT + 21, y, seg)
            y -= LH
    y -= LH * 2

footer(); c.showPage()

# index at the end
c.setFont("Helvetica-Bold", 14)
y = TOP
c.drawString(LEFT, y, "Index")
y -= 18
for path, p, n in toc:
    if y < BOTTOM:
        c.showPage(); y = TOP; c.setFont("Helvetica-Bold", 14)
        c.drawString(LEFT, y, "Index (cont.)"); y -= 18
    c.setFont("Courier", 7)
    c.setFillColorRGB(0.1, 0.11, 0.14)
    c.drawString(LEFT, y, path[:90])
    c.setFillColorRGB(0.5, 0.5, 0.55)
    c.drawRightString(W - LEFT - 30, y, "%d lines" % n)
    c.drawRightString(W - LEFT, y, "p.%d" % p)
    y -= 9.6
c.save()
print("OK", OUT, "pages:", page)

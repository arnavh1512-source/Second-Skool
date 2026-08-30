# -*- coding: utf-8 -*-
"""Drawing helpers shared by the Second Skool PDFs.

Everything is built from reportlab shapes so the pages stay vector and the
palette matches the app's own tokens.
"""
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.graphics.shapes import Drawing, Rect, String, Circle, Line, Polygon, Wedge, Group

# the app's own td-* palette
BLUE = colors.HexColor('#2a6fdb')
BLUE_L = colors.HexColor('#3f82ec')
DARK = colors.HexColor('#12203a')
TEXT = colors.HexColor('#3c4a63')
MUTED = colors.HexColor('#6b7a93')
FAINT = colors.HexColor('#a7b2c4')
LINE = colors.HexColor('#dde3ec')
SOFT = colors.HexColor('#f2f5fa')
CARD = colors.white
GREEN = colors.HexColor('#2fa36b')
AMBER = colors.HexColor('#d9862a')
RED = colors.HexColor('#e8553c')
INDIGO = colors.HexColor('#6366c9')
TINT_B = colors.HexColor('#e8f0fd')
TINT_G = colors.HexColor('#e4f5ec')
TINT_A = colors.HexColor('#fdf1e0')
TINT_R = colors.HexColor('#fdecea')
TINT_I = colors.HexColor('#ecedfa')

BOLD = 'Helvetica-Bold'
REG = 'Helvetica'


# ---------------------------------------------------------------- atoms ----
def card(g, x, y, w, h, fill=CARD, stroke=LINE, r=7, sw=0.7):
    g.add(Rect(x, y, w, h, rx=r, ry=r, fillColor=fill, strokeColor=stroke, strokeWidth=sw))


def txt(g, x, y, s, size=7, color=TEXT, bold=False, anchor='start'):
    g.add(String(x, y, s, fontName=BOLD if bold else REG, fontSize=size,
                 fillColor=color, textAnchor=anchor))


def pill(g, x, y, w, h, label, fill=TINT_B, fg=BLUE, size=6):
    g.add(Rect(x, y, w, h, rx=h / 2, ry=h / 2, fillColor=fill, strokeColor=None))
    txt(g, x + w / 2, y + h / 2 - size * 0.35, label, size, fg, True, 'middle')


def meter(g, x, y, w, pct, color=BLUE, track=SOFT, h=4):
    g.add(Rect(x, y, w, h, rx=h / 2, ry=h / 2, fillColor=track, strokeColor=None))
    if pct > 0:
        g.add(Rect(x, y, w * min(pct, 100) / 100.0, h, rx=h / 2, ry=h / 2,
                   fillColor=color, strokeColor=None))


def dot(g, x, y, r=2.4, color=RED):
    g.add(Circle(x, y, r, fillColor=color, strokeColor=None))


def arrow(g, x, y, w, color=FAINT):
    """A short horizontal arrow, y is the centre line."""
    g.add(Line(x, y, x + w - 3.5, y, strokeColor=color, strokeWidth=1.1))
    g.add(Polygon([x + w - 4.5, y - 2.6, x + w, y, x + w - 4.5, y + 2.6],
                  fillColor=color, strokeColor=None))


def down_arrow(g, x, y, h, color=FAINT):
    g.add(Line(x, y, x, y - h + 3.5, strokeColor=color, strokeWidth=1.1))
    g.add(Polygon([x - 2.6, y - h + 4.5, x, y - h, x + 2.6, y - h + 4.5],
                  fillColor=color, strokeColor=None))


def glyph(g, x, y, size, kind, color):
    """A tiny pictogram inside a size x size box at (x, y)."""
    s, c = size, color
    if kind == 'person':
        g.add(Circle(x + s / 2, y + s * 0.68, s * 0.17, fillColor=c, strokeColor=None))
        g.add(Wedge(x + s / 2, y + s * 0.30, s * 0.32, 0, 180, yradius=s * 0.26,
                    fillColor=c, strokeColor=None))
    elif kind == 'check':
        g.add(Polygon([x + s * .18, y + s * .52, x + s * .40, y + s * .28,
                       x + s * .84, y + s * .74, x + s * .40, y + s * .42],
                      fillColor=c, strokeColor=None))
    elif kind == 'chart':
        for i, hh in enumerate((.34, .58, .46, .78)):
            g.add(Rect(x + s * (.16 + i * .19), y + s * .16, s * .12, s * hh,
                       fillColor=c, strokeColor=None))
    elif kind == 'book':
        g.add(Rect(x + s * .18, y + s * .18, s * .64, s * .64, rx=s * .1, ry=s * .1,
                   fillColor=c, strokeColor=None))
        g.add(Line(x + s * .5, y + s * .22, x + s * .5, y + s * .78,
                   strokeColor=colors.white, strokeWidth=s * .07))
    elif kind == 'bell':
        g.add(Wedge(x + s / 2, y + s * .36, s * .30, 0, 180, yradius=s * .40,
                    fillColor=c, strokeColor=None))
        g.add(Rect(x + s * .20, y + s * .30, s * .60, s * .07, fillColor=c, strokeColor=None))
        g.add(Circle(x + s / 2, y + s * .24, s * .08, fillColor=c, strokeColor=None))
    elif kind == 'rupee':
        txt(g, x + s / 2, y + s * .26, 'Rs', s * .46, c, True, 'middle')
    elif kind == 'clock':
        g.add(Circle(x + s / 2, y + s / 2, s * .34, fillColor=None, strokeColor=c, strokeWidth=s * .09))
        g.add(Line(x + s / 2, y + s / 2, x + s / 2, y + s * .72, strokeColor=c, strokeWidth=s * .09))
        g.add(Line(x + s / 2, y + s / 2, x + s * .68, y + s / 2, strokeColor=c, strokeWidth=s * .09))
    elif kind == 'trophy':
        g.add(Wedge(x + s / 2, y + s * .62, s * .28, 180, 360, yradius=s * .30,
                    fillColor=c, strokeColor=None))
        g.add(Rect(x + s * .22, y + s * .58, s * .56, s * .06, fillColor=c, strokeColor=None))
        g.add(Rect(x + s * .44, y + s * .28, s * .12, s * .32, fillColor=c, strokeColor=None))
        g.add(Rect(x + s * .28, y + s * .20, s * .44, s * .10, rx=s * .04, ry=s * .04,
                   fillColor=c, strokeColor=None))
    elif kind == 'lock':
        g.add(Rect(x + s * .26, y + s * .18, s * .48, s * .36, rx=s * .07, ry=s * .07,
                   fillColor=c, strokeColor=None))
        g.add(Wedge(x + s / 2, y + s * .54, s * .18, 0, 180, yradius=s * .20,
                    fillColor=None, strokeColor=c, strokeWidth=s * .1))
    elif kind == 'phone':
        g.add(Rect(x + s * .30, y + s * .12, s * .40, s * .76, rx=s * .08, ry=s * .08,
                   fillColor=None, strokeColor=c, strokeWidth=s * .08))
        g.add(Circle(x + s / 2, y + s * .22, s * .04, fillColor=c, strokeColor=None))
    elif kind == 'building':
        g.add(Rect(x + s * .22, y + s * .16, s * .56, s * .66, fillColor=c, strokeColor=None))
        for r_ in range(3):
            for c_ in range(3):
                g.add(Rect(x + s * (.30 + c_ * .16), y + s * (.28 + r_ * .17), s * .09, s * .10,
                           fillColor=colors.white, strokeColor=None))


def icon_tile(g, x, y, s, kind, fg, bg, r=6):
    g.add(Rect(x, y, s, s, rx=r, ry=r, fillColor=bg, strokeColor=None))
    glyph(g, x + s * .18, y + s * .18, s * .64, kind, fg)


def ring(g, cx, cy, r, pct, color=colors.white, track=None, label=None,
         sub=None, thick=None, label_color=colors.white):
    thick = thick or r * 0.28
    track = track or colors.Color(1, 1, 1, 0.25)
    g.add(Circle(cx, cy, r, fillColor=None, strokeColor=track, strokeWidth=thick))
    if pct > 0:
        start = 90 - 360.0 * min(pct, 100) / 100.0
        g.add(Wedge(cx, cy, r + thick / 2, start, 90, yradius=r + thick / 2,
                    radius1=r - thick / 2, fillColor=color, strokeColor=None))
    if label:
        txt(g, cx, cy - r * .10, label, r * .52, label_color, True, 'middle')
    if sub:
        txt(g, cx, cy - r * .48, sub, r * .24, label_color, False, 'middle')


# --------------------------------------------------------------- phones ----
def phone_shell(g, x, y, w, h, title=None, tabs=None, accent=BLUE):
    """Draws the frame and returns (bx, by, bw, bh) of the usable body area."""
    g.add(Rect(x, y, w, h, rx=11, ry=11, fillColor=colors.HexColor('#e6ebf3'),
               strokeColor=colors.HexColor('#c9d3e2'), strokeWidth=1))
    ix, iy, iw, ih = x + 3, y + 3, w - 6, h - 6
    g.add(Rect(ix, iy, iw, ih, rx=9, ry=9, fillColor=SOFT, strokeColor=None))
    # notch
    g.add(Rect(x + w / 2 - 9, y + h - 6.5, 18, 3.2, rx=1.6, ry=1.6,
               fillColor=colors.HexColor('#c9d3e2'), strokeColor=None))
    top = y + h - 9
    if title:
        txt(g, ix + 7, top - 7, title, 7.2, DARK, True)
        top -= 13
    else:
        top -= 2
    bot = iy
    if tabs:
        th = 13
        g.add(Rect(ix, iy, iw, th, rx=0, ry=0, fillColor=CARD, strokeColor=None))
        g.add(Line(ix, iy + th, ix + iw, iy + th, strokeColor=LINE, strokeWidth=0.6))
        step = iw / float(len(tabs))
        for i, (lab, on) in enumerate(tabs):
            cx = ix + step * (i + .5)
            g.add(Circle(cx, iy + th - 5, 2.1, fillColor=accent if on else FAINT, strokeColor=None))
            txt(g, cx, iy + 2.6, lab, 4.6, accent if on else FAINT, on, 'middle')
        bot = iy + th
    return ix + 5, bot + 4, iw - 10, top - bot - 8


# ------------------------------------------------------------- diagrams ----
def flow(width, steps, accent=BLUE, box_h=46, sub_lines=2):
    """Horizontal numbered flow. steps = [(title, sub), ...]"""
    n = len(steps)
    gap = 13.0
    bw = (width - gap * (n - 1)) / n
    d = Drawing(width, box_h + 6)
    g = Group()
    for i, (title, sub) in enumerate(steps):
        x = i * (bw + gap)
        card(g, x, 3, bw, box_h, CARD, LINE)
        g.add(Circle(x + 11, 3 + box_h - 11, 7, fillColor=accent, strokeColor=None))
        txt(g, x + 11, 3 + box_h - 13.4, str(i + 1), 7.4, colors.white, True, 'middle')
        txt(g, x + 22, 3 + box_h - 14, title, 7.4, DARK, True)
        yy = 3 + box_h - 25
        for ln in _wrap(sub, int(bw / 3.55)):
            txt(g, x + 7, yy, ln, 6.4, MUTED)
            yy -= 8
        if i < n - 1:
            arrow(g, x + bw + 2.5, 3 + box_h / 2, gap - 5, FAINT)
    d.add(g)
    return d


def _wrap(s, n):
    out, cur = [], ''
    for word in s.split():
        if len(cur) + len(word) + 1 <= n:
            cur = (cur + ' ' + word).strip()
        else:
            out.append(cur)
            cur = word
    if cur:
        out.append(cur)
    return out


def role_trio(width):
    """Three role cards: what each one is for."""
    h = 88
    gap = 9
    bw = (width - gap * 2) / 3.0
    d = Drawing(width, h)
    g = Group()
    spec = [
        ('Head teacher', BLUE, TINT_B, 'building',
         ['Owns the centre', 'Staff, fees, branches', 'Reports and rankings', 'Edits the timetable']),
        ('Teacher', INDIGO, TINT_I, 'person',
         ['Joins with a code', 'Attendance and marks', 'Homework and notes', 'Sends reminders']),
        ('Student and parent', GREEN, TINT_G, 'phone',
         ['Signs in with a code', 'Sees everything', 'Changes nothing', 'Always notified']),
    ]
    for i, (name, fg, bg, ic, lines) in enumerate(spec):
        x = i * (bw + gap)
        card(g, x, 0, bw, h, CARD, LINE)
        g.add(Rect(x, h - 4, bw, 4, rx=0, ry=0, fillColor=fg, strokeColor=None))
        g.add(Rect(x, h - 8, bw, 5, fillColor=CARD, strokeColor=None))
        icon_tile(g, x + 9, h - 34, 21, ic, fg, bg)
        txt(g, x + 36, h - 24, name, 8.2, DARK, True)
        yy = h - 48
        for ln in lines:
            g.add(Circle(x + 12, yy + 2.2, 1.5, fillColor=fg, strokeColor=None))
            txt(g, x + 18, yy, ln, 6.8, TEXT)
            yy -= 11
    d.add(g)
    return d


def legend(width, items):
    """items = [(color, label), ...] on one line."""
    d = Drawing(width, 12)
    g = Group()
    x = 0
    for col, lab in items:
        g.add(Rect(x, 3, 7, 7, rx=2, ry=2, fillColor=col, strokeColor=None))
        txt(g, x + 11, 4.6, lab, 7, MUTED)
        x += 11 + len(lab) * 3.6 + 14
    d.add(g)
    return d

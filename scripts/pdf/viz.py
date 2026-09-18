# -*- coding: utf-8 -*-
"""Drawing helpers shared by the Second Skool PDFs.

Everything is built from reportlab shapes so the pages stay vector and the
palette matches the app's own tokens.
"""
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.graphics.shapes import Drawing, Rect, String, Circle, Line, Polygon, Wedge, Group

# the app's own td-* palette (the light "Register" theme in globals.css)
BLUE = colors.HexColor('#2c3e8f')    # td-primary
DARK = colors.HexColor('#14161a')    # td-dark, the ink
INDIGO = DARK                        # teacher accent: the app gives teachers ink, not a hue
TEXT = colors.HexColor('#33373d')
MUTED = colors.HexColor('#5e646b')
FAINT = colors.HexColor('#9098a1')
LINE = colors.HexColor('#dde0da')
BORDER = colors.HexColor('#c9ccc6')
SOFT = colors.HexColor('#f2f3f0')    # td-bg and td-soft
CARD = colors.white
GREEN = colors.HexColor('#1f7a4d')
AMBER = colors.HexColor('#b7791f')
RED = colors.HexColor('#c8463c')
TINT_B = colors.HexColor('#e6e9f4')
TINT_G = colors.HexColor('#e1f0e8')
TINT_A = colors.HexColor('#f6ecd9')
TINT_R = colors.HexColor('#f7e3e0')
ON_G = colors.HexColor('#145c39')
ON_A = colors.HexColor('#7a5211')
ON_R = colors.HexColor('#8a3229')

BOLD = 'Helvetica-Bold'
REG = 'Helvetica'
MONO = 'Courier-Bold'  # stands in for td-num (IBM Plex Mono)


# ---------------------------------------------------------------- atoms ----
def card(g, x, y, w, h, fill=CARD, stroke=LINE, r=2.5, sw=0.7):
    g.add(Rect(x, y, w, h, rx=r, ry=r, fillColor=fill, strokeColor=stroke, strokeWidth=sw))


def txt(g, x, y, s, size=7, color=TEXT, bold=False, anchor='start'):
    g.add(String(x, y, s, fontName=BOLD if bold else REG, fontSize=size,
                 fillColor=color, textAnchor=anchor))


def mono(g, x, y, s, size=6, color=DARK, anchor='start'):
    g.add(String(x, y, s, fontName=MONO, fontSize=size, fillColor=color, textAnchor=anchor))


def tag(g, x_end, y, label, fill=TINT_B, fg=BLUE, size=4.4):
    """A td-tag, right-aligned to x_end: mono uppercase on a tint."""
    w = len(label) * size * 0.6 + 4
    g.add(Rect(x_end - w, y, w, size + 2.6, rx=1.2, ry=1.2, fillColor=fill, strokeColor=None))
    mono(g, x_end - w / 2, y + 1.5, label.upper(), size, fg, 'middle')


def meter(g, x, y, w, pct, color=BLUE, track=LINE, h=2):
    g.add(Rect(x, y, w, h, fillColor=track, strokeColor=None))
    if pct > 0:
        g.add(Rect(x, y, w * min(pct, 100) / 100.0, h, fillColor=color, strokeColor=None))


def dot(g, x, y, r=2.4, color=RED):
    g.add(Circle(x, y, r, fillColor=color, strokeColor=None))


def arrow(g, x, y, w, color=FAINT):
    """A short horizontal arrow, y is the centre line."""
    g.add(Line(x, y, x + w - 3.5, y, strokeColor=color, strokeWidth=1.1))
    g.add(Polygon([x + w - 4.5, y - 2.6, x + w, y, x + w - 4.5, y + 2.6],
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


def icon_tile(g, x, y, s, kind, fg, bg, r=2.5):
    g.add(Rect(x, y, s, s, rx=r, ry=r, fillColor=bg, strokeColor=None))
    glyph(g, x + s * .18, y + s * .18, s * .64, kind, fg)


# --------------------------------------------------------------- phones ----
def phone_shell(g, x, y, w, h, title=None, tabs=None):
    """Draws the frame and returns (bx, by, bw, bh) of the usable body area.

    tabs = [(label, active, dot), ...]: the app's bottom nav, text over a 2px
    ink rule, the active tab in bold ink.
    """
    g.add(Rect(x, y, w, h, rx=11, ry=11, fillColor=colors.HexColor('#e4e6e1'),
               strokeColor=BORDER, strokeWidth=1))
    ix, iy, iw, ih = x + 3, y + 3, w - 6, h - 6
    g.add(Rect(ix, iy, iw, ih, rx=9, ry=9, fillColor=SOFT, strokeColor=None))
    g.add(Rect(x + w / 2 - 9, y + h - 6.5, 18, 3.2, rx=1.6, ry=1.6,
               fillColor=BORDER, strokeColor=None))
    top = y + h - 9
    if title:
        txt(g, ix + 5, top - 9, title, 8.6, DARK, True)
        top -= 15
    else:
        top -= 2
    bot = iy
    if tabs:
        th = 12
        g.add(Line(ix, iy + th, ix + iw, iy + th, strokeColor=DARK, strokeWidth=1.1))
        step = iw / float(len(tabs))
        for i, (lab, on, alert) in enumerate(tabs):
            cx = ix + step * (i + .5)
            txt(g, cx, iy + 4.2, lab, 4.3, DARK if on else MUTED, on, 'middle')
            if alert:
                dot(g, cx + len(lab) * 1.2 + 1.5, iy + 8.2, 1.1, RED)
        bot = iy + th
    return ix + 5, bot + 4, iw - 10, top - bot - 6


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
        g.add(Rect(x, 3 + box_h - 1.6, bw, 1.6, fillColor=accent, strokeColor=None))
        mono(g, x + 7, 3 + box_h - 14, '%02d' % (i + 1), 7.4, accent)
        txt(g, x + 21, 3 + box_h - 14, title, 7.4, DARK, True)
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
        ('Teacher', DARK, SOFT, 'person',
         ['Joins with a code', 'Attendance and marks', 'Homework and notes', 'Sends reminders']),
        ('Student and parent', GREEN, TINT_G, 'phone',
         ['Signs in with a code', 'Sees everything', 'Changes nothing', 'Always notified']),
    ]
    for i, (name, fg, bg, ic, lines) in enumerate(spec):
        x = i * (bw + gap)
        card(g, x, 0, bw, h, CARD, LINE)
        g.add(Rect(x, h - 1.8, bw, 1.8, fillColor=fg, strokeColor=None))
        icon_tile(g, x + 9, h - 34, 21, ic, fg, bg)
        txt(g, x + 36, h - 24, name, 8.2, DARK, True)
        yy = h - 48
        for ln in lines:
            g.add(Rect(x + 10.5, yy + 1, 3, 3, fillColor=fg, strokeColor=None))
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
        g.add(Rect(x, 3, 7, 7, rx=1, ry=1, fillColor=col, strokeColor=None))
        txt(g, x + 11, 4.6, lab, 7, MUTED)
        x += 11 + len(lab) * 3.6 + 14
    d.add(g)
    return d

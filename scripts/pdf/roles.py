# -*- coding: utf-8 -*-
"""Second Skool - the three roles, with visuals.

Everything here is drawn with canvas primitives rather than set as glyphs,
because Helvetica in ReportLab is WinAnsi: an arrow or a rupee sign becomes a
black box. Arrows, ticks and crosses are vector paths. Verify against the
RENDERED text, never the source.

Role colours run student green / teacher blue / head navy, and they stay
consistent from the first diagram to the last table so the reader can navigate
by colour alone.
"""
import os

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (BaseDocTemplate, Flowable, Frame, KeepTogether,
                                PageBreak, PageTemplate, Paragraph, Spacer,
                                Table, TableStyle)

INK    = colors.HexColor('#16202e')
MUTED  = colors.HexColor('#5b6878')
SUBTLE = colors.HexColor('#8d99a8')
BLUE   = colors.HexColor('#2a6fdb')
GREEN  = colors.HexColor('#2fa36b')
NAVY   = colors.HexColor('#1d3557')
RED    = colors.HexColor('#e8553c')
AMBER  = colors.HexColor('#d9922b')
RULE   = colors.HexColor('#d9e1ec')
LINE   = colors.HexColor('#eef1f7')
WASH   = colors.HexColor('#f2f6fc')
WGRN   = colors.HexColor('#e7f5ee')
WBLU   = colors.HexColor('#eaf1fc')
WNVY   = colors.HexColor('#e9edf4')
WHITE  = colors.white

W = 160 * mm   # usable column width

S = lambda n, **kw: ParagraphStyle(n, **kw)
title  = S('t',  fontName='Helvetica-Bold', fontSize=25,   leading=29,   textColor=INK, spaceAfter=3)
kicker = S('k',  fontName='Helvetica',      fontSize=11.5, leading=16,   textColor=MUTED, spaceAfter=14)
h1     = S('h1', fontName='Helvetica-Bold', fontSize=18,   leading=22,   textColor=INK, spaceBefore=2, spaceAfter=6)
h2     = S('h2', fontName='Helvetica-Bold', fontSize=13,   leading=17,   textColor=INK, spaceBefore=15, spaceAfter=7)
h3     = S('h3', fontName='Helvetica-Bold', fontSize=10.6, leading=14,   textColor=INK, spaceBefore=10, spaceAfter=4)
body   = S('b',  fontName='Helvetica',      fontSize=10.3, leading=15.4, textColor=INK, alignment=TA_LEFT, spaceAfter=7)
small  = S('s',  fontName='Helvetica',      fontSize=9.2,  leading=13.4, textColor=MUTED, spaceAfter=5)
cellh  = S('ch', fontName='Helvetica-Bold', fontSize=10.2, leading=13.6, textColor=INK)
cellb  = S('cb', fontName='Helvetica',      fontSize=9.7,  leading=13.6, textColor=MUTED)
stepn  = S('sn', fontName='Helvetica-Bold', fontSize=15,   leading=17,   textColor=BLUE)


# ---------------------------------------------------------------- primitives

def arrow(c, x1, y1, x2, y2, col=SUBTLE, w=1.1, head=3.4):
    """A straight arrow. Horizontal or vertical only - that is all this doc needs."""
    c.saveState()
    c.setStrokeColor(col); c.setFillColor(col); c.setLineWidth(w); c.setLineCap(1)
    if y1 == y2:
        d = 1 if x2 > x1 else -1
        c.line(x1, y1, x2 - d * head, y2)
        p = c.beginPath(); p.moveTo(x2, y2)
        p.lineTo(x2 - d * head, y2 + head * 0.62); p.lineTo(x2 - d * head, y2 - head * 0.62)
        p.close(); c.drawPath(p, fill=1, stroke=0)
    else:
        d = 1 if y2 > y1 else -1
        c.line(x1, y1, x2, y2 - d * head)
        p = c.beginPath(); p.moveTo(x2, y2)
        p.lineTo(x2 + head * 0.62, y2 - d * head); p.lineTo(x2 - head * 0.62, y2 - d * head)
        p.close(); c.drawPath(p, fill=1, stroke=0)
    c.restoreState()


def tick(c, x, y, col=GREEN, r=5.2):
    c.saveState()
    c.setFillColor(col); c.circle(x, y, r, fill=1, stroke=0)
    c.setStrokeColor(WHITE); c.setLineWidth(1.5); c.setLineCap(1); c.setLineJoin(1)
    p = c.beginPath()
    p.moveTo(x - r * 0.45, y + r * 0.03)
    p.lineTo(x - r * 0.10, y - r * 0.38)
    p.lineTo(x + r * 0.48, y + r * 0.40)
    c.drawPath(p, fill=0, stroke=1)
    c.restoreState()


def cross(c, x, y, col=colors.HexColor('#c9d1dd'), r=5.2):
    c.saveState()
    c.setFillColor(col); c.circle(x, y, r, fill=1, stroke=0)
    c.setStrokeColor(WHITE); c.setLineWidth(1.5); c.setLineCap(1)
    d = r * 0.40
    c.line(x - d, y - d, x + d, y + d)
    c.line(x - d, y + d, x + d, y - d)
    c.restoreState()


def chip(c, x, y, w, h, fill, text, tcol, size=7.4, r=None):
    c.saveState()
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, r if r is not None else h / 2, fill=1, stroke=0)
    c.setFillColor(tcol); c.setFont('Helvetica-Bold', size)
    c.drawCentredString(x + w / 2, y + h / 2 - size * 0.35, text)
    c.restoreState()


def card(c, x, y, w, h, border=RULE, fill=WHITE, r=7, lw=0.8):
    c.saveState()
    c.setFillColor(fill); c.setStrokeColor(border); c.setLineWidth(lw)
    c.roundRect(x, y, w, h, r, fill=1, stroke=1)
    c.restoreState()


def label(c, x, y, text, size=7.8, col=MUTED, font='Helvetica', centre=False):
    c.saveState()
    c.setFillColor(col); c.setFont(font, size)
    (c.drawCentredString if centre else c.drawString)(x, y, text)
    c.restoreState()


class Draw(Flowable):
    """Wraps a canvas-drawing function as a flowable of a fixed size."""
    def __init__(self, height, fn, width=W):
        Flowable.__init__(self)
        self.width, self.height, self.fn = width, height, fn

    def wrap(self, aw, ah):
        return self.width, self.height

    def draw(self):
        self.fn(self.canv, self.width, self.height)


# --------------------------------------------------------------- text blocks

def bullets(items, style=body):
    return [Paragraph(u'•  ' + t, style) for t in items]


def feature_table(rows, first=42):
    data = [[Paragraph(a, cellh), Paragraph(b, cellb)] for a, b in rows]
    t = Table(data, colWidths=[first * mm, (160 - first) * mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (0, -1), 8),
        ('LINEBELOW', (0, 0), (-1, -2), 0.6, RULE),
    ]))
    return t


def steps(rows, accent=BLUE):
    st = ParagraphStyle('sn2', parent=stepn, textColor=accent)
    data = [[Paragraph(str(i + 1), st), Paragraph(a, cellh), Paragraph(b, cellb)]
            for i, (a, b) in enumerate(rows)]
    t = Table(data, colWidths=[9 * mm, 40 * mm, 111 * mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, -2), 0.6, RULE),
    ]))
    return t


def callout(paras, accent=BLUE, wash=WASH):
    inner = Table([[p] for p in paras], colWidths=[148 * mm])
    inner.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    t = Table([[inner]], colWidths=[160 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), wash),
        ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 11), ('BOTTOMPADDING', (0, 0), (-1, -1), 11),
        ('LINEBEFORE', (0, 0), (0, -1), 2.5, accent),
    ]))
    return t


def section(word, colour, wash):
    """A coloured band that opens a role's chapter."""
    def d(c, w, h):
        c.setFillColor(wash); c.roundRect(0, 0, w, h, 6, fill=1, stroke=0)
        c.setFillColor(colour); c.rect(0, 0, 3.2, h, fill=1, stroke=0)
        c.setFillColor(colour); c.setFont('Helvetica-Bold', 15)
        c.drawString(13, h / 2 - 5.2, word)
    return Draw(26, d)


# ------------------------------------------------------------------ visual 1
# Three roles side by side: who they are, what they hold, how they get in.

def three_roles(c, w, h):
    cols = [
        ('STUDENT & PARENT', GREEN, WGRN, 'No account',
         ['Opens a link, types a code', 'Reads only - changes nothing',
          'Same code works on the', 'parent\'s phone at the same time']),
        ('TEACHER', BLUE, WBLU, 'Google or password',
         ['Approved by the head', 'Records the day\'s work',
          'Cannot see fees, cannot', 'add or edit a student']),
        ('HEAD TEACHER', NAVY, WNVY, 'Google or password',
         ['Owns the centre', 'Everything a teacher can do',
          'Plus staff, fees, students,', 'branches, batches, subjects']),
    ]
    cw = (w - 2 * 8) / 3.0
    for i, (name, col, wash, auth, lines) in enumerate(cols):
        x = i * (cw + 8)
        card(c, x, 0, cw, h, border=col, fill=wash, r=8, lw=1.1)
        c.setFillColor(col); c.roundRect(x, h - 22, cw, 22, 8, fill=1, stroke=0)
        c.setFillColor(col); c.rect(x, h - 22, cw, 8, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont('Helvetica-Bold', 8.6)
        c.drawCentredString(x + cw / 2, h - 15, name)
        label(c, x + cw / 2, h - 36, 'SIGNS IN WITH', 6.8, SUBTLE, 'Helvetica-Bold', True)
        label(c, x + cw / 2, h - 48, auth, 10, col, 'Helvetica-Bold', True)
        c.setStrokeColor(colors.Color(col.red, col.green, col.blue, 0.28))
        c.setLineWidth(0.7); c.line(x + 12, h - 58, x + cw - 12, h - 58)
        y = h - 72
        for ln in lines:
            label(c, x + 12, y, ln, 7.9, INK if lines.index(ln) == 0 else MUTED)
            y -= 11.5


# ------------------------------------------------------------------ visual 2
# The three codes. This is the single thing everyone gets wrong.

def code_map(c, w, h):
    rows = [
        ('CENTRE JOIN CODE', '7X2K9Q', BLUE, WBLU,
         'Head shares with a teacher', 'Staff tab, top of screen',
         ('Teacher types it once on', 'the "Join a centre" screen')),
        ('STUDENT CODE', '4M8P2T', GREEN, WGRN,
         'Head or teacher shares it', 'More > Student requests',
         ('Student types it once to', 'register themselves')),
        ('PERSONAL CODE', 'TUT-A1B2C3D4', NAVY, WNVY,
         'Issued on approval', 'Students > tap the student',
         ('The actual login - student', 'and parent both use it')),
    ]
    rh = (h - 2 * 7) / 3.0
    for i, (name, sample, col, wash, who, where, use) in enumerate(rows):
        y = h - (i + 1) * rh - i * 7
        card(c, 0, y, w, rh, border=RULE, fill=WHITE, r=7)
        c.setFillColor(wash); c.roundRect(0, y, 52 * mm, rh, 7, fill=1, stroke=0)
        c.setFillColor(wash); c.rect(46 * mm, y, 6 * mm, rh, fill=1, stroke=0)
        c.setStrokeColor(col); c.setLineWidth(2.4); c.line(1.2, y + 4, 1.2, y + rh - 4)
        label(c, 12, y + rh - 15, name, 6.8, SUBTLE, 'Helvetica-Bold')
        c.setFillColor(col); c.setFont('Helvetica-Bold', 13)
        c.drawString(12, y + rh - 32, sample)
        x = 52 * mm + 12
        label(c, x, y + rh - 13, 'WHO GIVES IT', 6.4, SUBTLE, 'Helvetica-Bold')
        label(c, x, y + rh - 24, who, 8.2, INK)
        label(c, x, y + rh - 37, 'FOUND AT', 6.4, SUBTLE, 'Helvetica-Bold')
        label(c, x, y + rh - 48, where, 8.2, MUTED)
        x3 = 108 * mm
        label(c, x3, y + rh - 13, 'WHAT IT DOES', 6.4, SUBTLE, 'Helvetica-Bold')
        label(c, x3, y + rh - 24, use[0], 8.2, MUTED)
        label(c, x3, y + rh - 35, use[1], 8.2, MUTED)


# ------------------------------------------------------------------ visual 3
# Phone mockups. One per role, drawn to the app's real tab bars.

def phone(c, x, y, pw, ph, accent, header, subhead, tiles, tabs, active=0,
          badge=None, tilecols=2):
    # body
    c.saveState()
    c.setFillColor(colors.HexColor('#f7f9fc')); c.setStrokeColor(colors.HexColor('#c9d3e2'))
    c.setLineWidth(1.1); c.roundRect(x, y, pw, ph, 11, fill=1, stroke=1)
    # header
    c.setFillColor(accent); c.roundRect(x, y + ph - 34, pw, 34, 11, fill=1, stroke=0)
    c.setFillColor(accent); c.rect(x, y + ph - 34, pw, 12, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont('Helvetica-Bold', 8.4)
    c.drawString(x + 9, y + ph - 17, header)
    c.setFillColor(colors.Color(1, 1, 1, 0.8)); c.setFont('Helvetica', 6.6)
    c.drawString(x + 9, y + ph - 27, subhead)
    # tiles
    tabh = 20
    gap = 4
    tw = (pw - 18 - gap * (tilecols - 1)) / float(tilecols)
    rows = (len(tiles) + tilecols - 1) // tilecols
    th = 20
    ty = y + ph - 34 - 10 - th
    for i, (t, sub) in enumerate(tiles):
        r, col = divmod(i, tilecols)
        tx = x + 9 + col * (tw + gap)
        yy = ty - r * (th + gap)
        c.setFillColor(WHITE); c.setStrokeColor(LINE); c.setLineWidth(0.7)
        c.roundRect(tx, yy, tw, th, 4, fill=1, stroke=1)
        c.setFillColor(INK); c.setFont('Helvetica-Bold', 6.5)
        c.drawString(tx + 5, yy + th - 8.5, t)
        c.setFillColor(SUBTLE); c.setFont('Helvetica', 5.8)
        c.drawString(tx + 5, yy + 5, sub)
    # tab bar
    c.setFillColor(WHITE); c.roundRect(x, y, pw, tabh, 11, fill=1, stroke=0)
    c.setFillColor(WHITE); c.rect(x, y + 8, pw, tabh - 8, fill=1, stroke=0)
    c.setStrokeColor(LINE); c.setLineWidth(0.8); c.line(x, y + tabh, x + pw, y + tabh)
    n = len(tabs)
    for i, t in enumerate(tabs):
        cx = x + (i + 0.5) * (pw / float(n))
        on = (i == active)
        c.setFillColor(accent if on else colors.HexColor('#9aa4b6'))
        c.circle(cx, y + 13.5, 2.4, fill=1, stroke=0)
        c.setFont('Helvetica-Bold', 5.6 if n <= 4 else 4.8)
        c.drawCentredString(cx, y + 5, t)
        if badge is not None and i == badge:
            c.setFillColor(RED); c.circle(cx + 4.2, y + 16, 2.1, fill=1, stroke=0)
    c.restoreState()


def phones_row(c, w, h):
    pw, ph = 44 * mm, h - 16
    gap = (w - 3 * pw) / 2.0
    phone(c, 0, 16, pw, ph, GREEN, 'Hi, Neha', 'Class 10 - Sharma Classes',
          [('Attendance', '92%'), ('Results', '4 tests'),
           ('Timetable', 'Today: 2'), ('Homework', '1 due'),
           ('Material', 'New'), ('Fees', 'Rs. 1,500 due')],
          ['Home', 'Results', 'Rank', 'Teachers', 'Profile'], 0)
    label(c, pw / 2, 4, 'STUDENT & PARENT', 7, GREEN, 'Helvetica-Bold', True)

    x2 = pw + gap
    phone(c, x2, 16, pw, ph, BLUE, 'Hi, Priya', 'Teacher',
          [('Classes today', '4'), ('Students', '38'),
           ('Attendance', 'Mark'), ('Results', 'Enter'),
           ('Assignment', 'Set'), ('Reminder', 'Send')],
          ['Home', 'Timetable', 'Students', 'More'], 0, badge=3)
    label(c, x2 + pw / 2, 4, 'TEACHER', 7, BLUE, 'Helvetica-Bold', True)

    x3 = 2 * (pw + gap)
    phone(c, x3, 16, pw, ph, NAVY, 'Hi, Rakesh', 'Head Teacher',
          [('Classes today', '4'), ('Students', '38'),
           ('Attendance', 'Mark'), ('Results', 'Enter'),
           ('Assignment', 'Set'), ('Reminder', 'Send')],
          ['Home', 'Timetable', 'Students', 'Staff', 'More'], 0, badge=4)
    label(c, x3 + pw / 2, 4, 'HEAD TEACHER', 7, NAVY, 'Helvetica-Bold', True)


# ------------------------------------------------------------------ visual 4
# Flow strips.

def flow(boxes, accent, note=None):
    def d(c, w, h):
        n = len(boxes)
        gap = 16
        bw = (w - gap * (n - 1)) / float(n)
        top = h if note is None else h - 12
        bh = top
        for i, (t, sub) in enumerate(boxes):
            x = i * (bw + gap)
            card(c, x, h - bh, bw, bh, border=accent if i in (0, n - 1) else RULE,
                 fill=WHITE, r=7, lw=1.0 if i in (0, n - 1) else 0.8)
            c.setFillColor(accent); c.setFont('Helvetica-Bold', 7)
            c.drawString(x + 8, h - 14, 'STEP %d' % (i + 1))
            c.setFillColor(INK); c.setFont('Helvetica-Bold', 8.4)
            c.drawString(x + 8, h - 27, t)
            c.setFillColor(MUTED); c.setFont('Helvetica', 6.9)
            yy = h - 38
            for ln in sub:
                c.drawString(x + 8, yy, ln); yy -= 9.2
            if i < n - 1:
                arrow(c, x + bw + 3, h - bh / 2, x + bw + gap - 3, h - bh / 2, accent)
        if note:
            c.setFillColor(SUBTLE); c.setFont('Helvetica-Oblique', 7.4)
            c.drawString(0, 1, note)
    return Draw(92 if note is None else 104, d)


# ------------------------------------------------------------------ visual 5
# Capability matrix.

def matrix(c, w, h):
    rows = [
        ('Mark attendance',                    1, 1),
        ('Enter test results',                 1, 1),
        ('Set assignments',                    1, 1),
        ('Upload study material',              1, 1),
        ('Send reminders to parents',          1, 1),
        ('Approve a student who registered',   1, 1),
        ('See the student list',               1, 1),
        ('See the timetable',                  1, 1),
        ('Add or edit a student',              0, 1),
        ('Edit the timetable',                 0, 1),
        ('See and record fees',                0, 1),
        ('Send the weekly WhatsApp report',    0, 1),
        ('Manage rankings and subjects',       0, 1),
        ('Schedule parent meetings',           0, 1),
        ('Add branches and batches',           0, 1),
        ('Approve or remove a teacher',        0, 1),
        ('Make someone else a head teacher',   0, 1),
        ('Change the centre name and logo',    0, 1),
        ('Regenerate the student code',        0, 1),
    ]
    hh = 22
    rh = (h - hh) / float(len(rows))
    cx1, cx2 = w - 62, w - 24
    # header
    c.setFillColor(WASH); c.roundRect(0, h - hh, w, hh, 5, fill=1, stroke=0)
    label(c, 10, h - hh + 7.5, 'WHAT IT DOES', 7, SUBTLE, 'Helvetica-Bold')
    label(c, cx1, h - hh + 7.5, 'TEACHER', 7, BLUE, 'Helvetica-Bold', True)
    label(c, cx2, h - hh + 7.5, 'HEAD', 7, NAVY, 'Helvetica-Bold', True)
    for i, (name, t, hd) in enumerate(rows):
        y = h - hh - (i + 1) * rh
        if i % 2 == 0:
            c.setFillColor(colors.HexColor('#fafbfd')); c.rect(0, y, w, rh, fill=1, stroke=0)
        c.setStrokeColor(LINE); c.setLineWidth(0.6); c.line(0, y, w, y)
        label(c, 10, y + rh / 2 - 3, name, 8.6, INK if t == 0 else MUTED,
              'Helvetica-Bold' if t == 0 else 'Helvetica')
        (tick if t else cross)(c, cx1, y + rh / 2, BLUE if t else colors.HexColor('#dbe1ea'), 4.8)
        (tick if hd else cross)(c, cx2, y + rh / 2, NAVY if hd else colors.HexColor('#dbe1ea'), 4.8)


# ------------------------------------------------------------------ visual 6
# Where a notification comes from.

def notif_map(c, w, h):
    src = [('Marked absent', GREEN), ('Result entered', GREEN),
           ('Fee reminder', AMBER), ('Approved', GREEN),
           ('Meeting set', BLUE)]
    bw = (w * 0.34)
    bh = 15
    gap = 4.5
    total = len(src) * bh + (len(src) - 1) * gap
    y0 = (h - total) / 2.0
    for i, (t, col) in enumerate(src):
        y = y0 + (len(src) - 1 - i) * (bh + gap)
        card(c, 0, y, bw, bh, border=RULE, fill=WHITE, r=4)
        c.setFillColor(col); c.circle(9, y + bh / 2, 2.6, fill=1, stroke=0)
        label(c, 16, y + bh / 2 - 2.6, t, 7.8, INK)
    # funnel
    c.setStrokeColor(colors.HexColor('#c9d3e2')); c.setLineWidth(0.9)
    for i in range(len(src)):
        y = y0 + (len(src) - 1 - i) * (bh + gap) + bh / 2
        c.line(bw + 3, y, bw + 16, y)
        c.line(bw + 16, y, bw + 16, h / 2)
    arrow(c, bw + 16, h / 2, w * 0.56, h / 2, SUBTLE)
    # phone
    px = w * 0.60
    card(c, px, h / 2 - 24, w - px, 48, border=NAVY, fill=WNVY, r=7, lw=1.1)
    label(c, px + 12, h / 2 + 13, 'PHONE NOTIFICATION', 6.4, SUBTLE, 'Helvetica-Bold')
    label(c, px + 12, h / 2 + 1, 'Sharma Classes', 9.4, NAVY, 'Helvetica-Bold')
    label(c, px + 12, h / 2 - 12, 'Neha was marked absent today', 7.8, MUTED)
    label(c, px + 12, h / 2 - 34, 'The centre name is always the heading.', 7, SUBTLE, 'Helvetica-Oblique')


# =============================================================== the document

story = []

story.append(Paragraph('Second Skool', title))
story.append(Paragraph('What every person in the centre can do &mdash; the head teacher, the teachers, '
                       'and the students and parents who never sign up for anything.', kicker))

story.append(Paragraph('Three people, one app', h2))
story.append(Paragraph(
    'Second Skool has exactly three kinds of user. What you see when you open it is decided entirely by '
    'which one you are &mdash; there are no settings to configure and no plans to choose between.', body))
story.append(Draw(112, three_roles))
story.append(Spacer(1, 12))
story.append(callout([Paragraph(
    '<b>The head teacher is the only person who can change how the centre is set up.</b> Teachers record '
    'the day&rsquo;s work and nothing else &mdash; they cannot see fees, cannot edit a student&rsquo;s details, and cannot '
    'add or remove staff. That is deliberate: it means a new teacher can be handed the app on day one '
    'without anyone worrying about what they might break.', body)]))

story.append(Paragraph('What each one actually looks like', h2))
story.append(Draw(150, phones_row))
story.append(Spacer(1, 4))
story.append(Paragraph(
    'The difference between a teacher and a head teacher is visible in the bottom bar: the head has a fifth '
    '<b>Staff</b> tab. The red dot means something is waiting for a decision.', small))

story.append(PageBreak())

# --------------------------------------------------------------- the codes
story.append(Paragraph('The three codes', h1))
story.append(Paragraph(
    'Nearly every support question comes down to someone using the wrong code. There are three, they look '
    'similar, and they do completely different things.', body))
story.append(Spacer(1, 4))
story.append(Draw(176, code_map))
story.append(Spacer(1, 10))
story.append(callout([Paragraph(
    '<b>The trap:</b> on the student registration form the field is labelled &ldquo;Student code&rdquo;, and it wants the '
    '<b>short centre code</b> &mdash; not the TUT- code. The TUT- code does not exist yet at that point; it is created '
    'when the request is approved. If someone reports &ldquo;my code doesn&rsquo;t work&rdquo;, this is almost always why.', body)],
    accent=RED, wash=colors.HexColor('#fdf3f0')))

story.append(Paragraph('When a code does not work', h3))
story.append(feature_table([
    ('&ldquo;It says invalid code&rdquo;',
     'A centre code was typed on the student sign-in screen, or a TUT- code was typed into the registration form. '
     'The two screens want opposite things.'),
    ('&ldquo;It worked last week&rdquo;',
     'The student code was regenerated. Only the head can do that, and the old one stops working the moment they do.'),
    ('&ldquo;I registered but nothing happened&rdquo;',
     'Nothing is wrong. The request is sitting on the teacher&rsquo;s More screen waiting to be approved.'),
    ('&ldquo;The teacher cannot see the centre&rdquo;',
     'They joined with the code but have not been approved yet. The head does that from the Staff tab.'),
], first=52))

story.append(PageBreak())

story.append(Paragraph('How each person gets in', h1))
story.append(Paragraph(
    'Three journeys, three different codes. Nobody signs up the same way as anybody else.', body))
story.append(Spacer(1, 6))

story.append(Paragraph('A head teacher, starting a centre', h3))
story.append(flow([
    ('Sign in', ['Google, or email', 'and password']),
    ('Tell us about you', ['Name, phone, subject,', 'qualification']),
    ('Create a centre', ['Name it. You become', 'the head teacher']),
    ('You are in', ['Two codes are waiting:', 'one for staff, one', 'for students']),
], NAVY, 'Nobody approves the head. Creating the centre is what makes you one.'))

story.append(Paragraph('A teacher, joining that centre', h3))
story.append(flow([
    ('Sign in', ['Google, or email', 'and password']),
    ('Tell us about you', ['Students see these', 'on your profile']),
    ('Join a centre', ['Type the centre', 'join code']),
    ('Wait for approval', ['The head approves', 'you from the Staff', 'tab']),
], BLUE, 'Until the head approves, the teacher sees a waiting screen and nothing else.'))

story.append(Paragraph('A student, with no account at all', h3))
story.append(flow([
    ('Open the link', ['Sent on WhatsApp.', 'Nothing to download']),
    ('Have a code?', ['Type TUT-A1B2C3D4', 'and you are in']),
    ('Or register', ['Student code, name,', "parent's phone,", 'class, school']),
    ('Wait for approval', ['A teacher approves.', 'The screen moves on', 'by itself']),
], GREEN, 'The waiting screen checks by itself every few seconds - there is nothing to tap.'))

story.append(Spacer(1, 10))
story.append(callout([Paragraph(
    '<b>Everyone except the head waits for somebody.</b> A teacher waits for the head; a student waits for a teacher. '
    'Nothing in the app lets a person approve themselves, and nothing is visible to them until they are approved &mdash; '
    'which is why a centre&rsquo;s records cannot be reached by anybody the centre has not let in.', body)],
    accent=NAVY, wash=WNVY))

story.append(PageBreak())

# --------------------------------------------------------------- STUDENT
story.append(section('THE STUDENT AND PARENT', GREEN, WGRN))
story.append(Spacer(1, 10))
story.append(Paragraph(
    'A student reads. They cannot enter, edit or hide anything &mdash; every number on the screen was put there by '
    'a teacher. That is the whole point: a parent is looking at the centre&rsquo;s own record, not a version of it '
    'prepared for them.', body))

story.append(Spacer(1, 2))
story.append(callout([Paragraph(
    '<b>Parents use this same path.</b> There is no separate parent login &mdash; the TUT- code works on the '
    'parent&rsquo;s phone and the child&rsquo;s at the same time, and neither blocks the other.', body)], accent=GREEN, wash=WGRN))

story.append(Paragraph('The five tabs', h3))
story.append(feature_table([
    ('Home', 'Six tiles: Attendance, Results, Timetable, Homework, Material, Fees. Plus an <b>Alerts</b> button '
             'that turns on notifications and fires a test one immediately, so nobody finds out weeks later that it never worked.'),
    ('Results', 'Every test, marks out of the total, building into a report card across the term.'),
    ('Ranking', 'Where the student stands in their class, subject by subject.'),
    ('Teachers', 'Who teaches them, what each teacher&rsquo;s subject and qualification is, and how to reach them.'),
    ('Profile', 'Their details, and &ldquo;Use a different code&rdquo; &mdash; how a parent with two children at the centre switches between them.'),
], first=30))

story.append(Paragraph('What the tiles open', h3))
story.append(feature_table([
    ('Attendance',  'A percentage, then every single day marked present or absent. A dash instead of a number means '
                    '<b>not yet marked</b> &mdash; it never shows a misleading 0%.'),
    ('Timetable',   'Which classes fall on which day.'),
    ('Homework',    'Work the teacher set, with the date it is due. The teacher calls this &ldquo;Assignments&rdquo;.'),
    ('Material',    'Notes and files the teacher uploaded. A dot marks anything new since the last visit.'),
    ('Fees',        'What is due, when, and every payment already recorded. <b>&ldquo;Pay now&rdquo; does not take money</b> &mdash; '
                    'the app handles no payments at all. It only prompts you to settle up with the centre as usual.'),
], first=30))

story.append(Spacer(1, 8))
story.append(callout([Paragraph(
    '<b>A student cannot change what a parent sees.</b> There is no edit button anywhere on the student side. '
    'A bad test result cannot be deleted, and a missed class cannot be talked away.', body)], accent=GREEN, wash=WGRN))

story.append(PageBreak())

# --------------------------------------------------------------- TEACHER
story.append(section('THE TEACHER', BLUE, WBLU))
story.append(Spacer(1, 10))
story.append(Paragraph(
    'A teacher&rsquo;s app is built around one question: what happened in class today? Four tabs, four quick '
    'actions on the home screen, and a <b>More</b> list holding the six things they do repeatedly.', body))

story.append(Paragraph('The four tabs', h3))
story.append(feature_table([
    ('Home',      'Classes today and total students, then four quick actions: Attendance, Results, Assignment, Reminder. '
                  'A bell for anything needing attention.'),
    ('Timetable', 'The week, read-only. Only the head can change it.'),
    ('Students',  'The full list with class and batch. A teacher can look but not tap through &mdash; editing a student is head-only.'),
    ('More',      'The six daily tools below. A red dot appears when a student request is waiting.'),
], first=30))

story.append(Paragraph('The six daily tools', h3))
story.append(feature_table([
    ('Student requests', 'Students who registered themselves. Review their details, set batch and branch, approve or reject. '
                         '<b>Their code does not work until this is done</b> &mdash; and approving sends them a notification straight away. '
                         'The centre&rsquo;s student code sits at the top of this screen, ready to copy and share.'),
    ('Mark attendance',  'The day&rsquo;s roll. This is the single most important thing in the app: it is what a parent checks.'),
    ('Enter results',    'Test name, marks, total. Feeds Results, the report card and Rankings all at once.'),
    ('Assignments',      'Set work with a due date. Appears on the student&rsquo;s home screen as Homework.'),
    ('Study material',   'Upload notes and files. Students see a dot on Material until they open it.'),
    ('Send reminders',   'Push a message to parents&rsquo; phones.'),
], first=36))

story.append(Spacer(1, 8))
story.append(callout([Paragraph(
    '<b>What a teacher deliberately cannot reach:</b> fees, the weekly report, meetings, branches, batches, '
    'subjects, the staff list, and adding or editing any student. None of it is hidden behind a warning &mdash; '
    'those screens simply are not in their app.', body)]))

story.append(PageBreak())

# --------------------------------------------------------------- HEAD
story.append(section('THE HEAD TEACHER', NAVY, WNVY))
story.append(Spacer(1, 10))
story.append(Paragraph(
    'The head does everything a teacher does, and owns everything a teacher cannot touch. Two things mark '
    'them out: a fifth <b>Staff</b> tab, and a <b>Management</b> section that appears under More.', body))

story.append(Paragraph('The Staff tab &mdash; head only', h3))
story.append(feature_table([
    ('The join code',     'Sits at the top, ready to copy. This is what a new teacher types on &ldquo;Join a centre&rdquo;.'),
    ('Pending approval',  'Teachers who joined with the code and are waiting. Approve or reject. The list refreshes '
                          'live &mdash; a teacher who signs up while the screen is open appears without a reload.'),
    ('Active staff',      'Everyone with access, each tagged <b>Head</b> or <b>Teacher</b>.'),
    ('Make head teacher', 'Promote a teacher to head. If they asked for it, the button says so. Grant this only to '
                          'someone you trust completely &mdash; it hands over fees, students and staff.'),
    ('Remove',            'Revoke a teacher&rsquo;s access. Their recorded work stays.'),
], first=36))

story.append(Paragraph('The Management section &mdash; head only', h3))
story.append(feature_table([
    ('Staff access & approvals', 'The same screen as the Staff tab, reachable from More.'),
    ('Weekly report',   'A written progress summary per student &mdash; attendance, marks, fees &mdash; sent to that parent on '
                        'WhatsApp in one tap. Switchable between the last 7 and 30 days. This is the feature parents notice.'),
    ('Fees & alerts',   'Record what a student owes, for which period, due when. Mark paid. Remove a record entered by '
                        'mistake &mdash; deliberately separate from marking it paid, which would log money never collected.'),
    ('Rankings',        'Class positions, grouped by subject once subjects exist.'),
    ('Meetings',        'Schedule a parent-teacher meeting; it lands on every parent&rsquo;s home screen. Cancelling removes it '
                        'silently, so tell them yourself.'),
    ('Branches',        'More than one location. The head switches between them from the home screen; a teacher just sees theirs.'),
    ('Subjects',        'The subject list rankings and results are grouped by.'),
    ('Batches',         'Group students. Removing a batch keeps every record &mdash; only the label goes.'),
], first=36))

story.append(Paragraph('Also head-only', h3))
story.append(feature_table([
    ('Add & edit students', 'Adding a student issues their TUT- code on the spot. Parent phone, class, school and address live here.'),
    ('Edit the timetable',  'Add, change and delete periods.'),
    ('Centre name & logo',  'Set from My Profile. The logo and name appear on every notification a parent receives.'),
    ('New student code',    'Regenerate it if it leaks. The old one stops working immediately &mdash; anyone yet to register needs the new one.'),
], first=36))

story.append(Spacer(1, 14))

# --------------------------------------------------------------- MATRIX
story.append(Paragraph('Teacher or head &mdash; the full list', h1))
story.append(Paragraph(
    'Every capability in the app, and who holds it. The rows in bold are the ones that separate the two.', body))
story.append(Spacer(1, 4))
story.append(Draw(330, matrix))

story.append(Spacer(1, 12))
story.append(callout([Paragraph(
    '<b>There is one head teacher per centre.</b> The head can hand the role to a teacher from the Staff tab, and a '
    'teacher can ask for it &mdash; but nothing in the app promotes anybody automatically.', body)], accent=NAVY, wash=WNVY))

story.append(PageBreak())

# --------------------------------------------------------------- NOTIFS
story.append(Paragraph('Notifications', h1))
story.append(Paragraph(
    'A parent will not open the app every day. Notifications are what make the record useful rather than merely '
    'available &mdash; and they only work once the app is on the home screen. A page left open in a browser tab '
    'reaches nobody.', body))
story.append(Spacer(1, 6))
story.append(Draw(120, notif_map))
story.append(Spacer(1, 8))

story.append(Paragraph('Turning them on &mdash; once, per phone', h3))
story.append(steps([
    ('Install it', 'Android shows an <b>Install Second Skool</b> bar at the bottom &mdash; tap Install. '
                   'On iPhone, tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>. Open it from the icon afterwards, not from Safari.'),
    ('Tap Alerts', 'On the home screen. The phone asks for permission &mdash; tap <b>Allow</b>.'),
    ('Check the test', 'One arrives immediately, headed with the centre&rsquo;s name. If it does not, notifications are off for that phone.'),
], accent=NAVY))

story.append(Paragraph('Who gets told what', h3))
story.append(feature_table([
    ('Student and parent', 'Attendance marked, results entered, fee reminders, meetings scheduled, and approval when a '
                           'self-registration goes through.'),
    ('Teacher',            'A student has registered and is waiting for review.'),
    ('Head teacher',       'The same, plus a teacher requesting access to the centre.'),
], first=42))

story.append(Spacer(1, 10))
story.append(callout([Paragraph(
    '<b>Every notification is headed with the centre&rsquo;s name.</b> A parent with two children at two different '
    'centres always knows which one is writing to them.', body)], accent=NAVY, wash=WNVY))

story.append(PageBreak())

story.append(Paragraph('A day, end to end', h1))
story.append(Paragraph(
    'Every feature in this document, in the order a centre actually meets them.', body))
story.append(Spacer(1, 6))
story.append(feature_table([
    ('Morning',   'The teacher opens Attendance and marks the roll. Parents of absent students are told within seconds.'),
    ('After a test', 'The teacher enters marks. Results, the report card and Rankings all update from that one entry.'),
    ('Any time',  'A student registers themselves with the centre code. A red dot appears on More. The teacher approves; '
                  'the student&rsquo;s waiting screen moves on by itself and their code goes live.'),
    ('End of week', 'The head opens Weekly report and sends each parent their child&rsquo;s summary on WhatsApp.'),
    ('Month end',  'The head records fees. Parents see what is due and get a reminder.'),
], first=30))

story.append(Spacer(1, 10))
story.append(callout([Paragraph(
    '<b>The whole design in one line:</b> the teacher enters each thing exactly once, the parent sees everything, '
    'and the child cannot get between the two.', body)]))




def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(RULE); canvas.setLineWidth(0.6)
    canvas.line(25 * mm, 16 * mm, 185 * mm, 16 * mm)
    canvas.setFont('Helvetica', 8.4); canvas.setFillColor(MUTED)
    canvas.drawString(25 * mm, 11 * mm, 'Second Skool  |  Features by role')
    canvas.drawRightString(185 * mm, 11 * mm, 'Page %d' % doc.page)
    canvas.restoreState()


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'Second-Skool-Features-by-Role.pdf')

doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=25 * mm, rightMargin=25 * mm, topMargin=22 * mm, bottomMargin=22 * mm,
                      title='Second Skool - Features by role', author='Second Skool')
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='f')
doc.addPageTemplates([PageTemplate(id='p', frames=[frame], onPage=footer)])
doc.build(story)
print('built')

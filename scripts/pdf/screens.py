# -*- coding: utf-8 -*-
"""Phone mockups of the real Second Skool screens, drawn from the app's layout."""
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing, Rect, String, Circle, Line, Group
from viz import (card, txt, pill, meter, dot, icon_tile, ring, glyph, arrow,
                 phone_shell, _wrap, BLUE, BLUE_L, DARK, TEXT, MUTED, FAINT, LINE,
                 SOFT, CARD, GREEN, AMBER, RED, INDIGO, TINT_B, TINT_G, TINT_A,
                 TINT_R, TINT_I)

PW, PH = 118, 256  # one phone


def phone_row(width, specs, caption_size=7.2, pw=PW, ph=PH):
    """specs = [(title, tabs, draw_fn, caption), ...] laid out across `width`."""
    n = len(specs)
    cap_h = 26
    d = Drawing(width, ph + cap_h)
    g = Group()
    gap = min((width - n * pw) / (n - 1), 52) if n > 1 else 0
    left = (width - (n * pw + gap * (n - 1))) / 2
    for i, (title, tabs, fn, caption) in enumerate(specs):
        x = left + i * (pw + gap)
        bx, by, bw, bh = phone_shell(g, x, cap_h, pw, ph, title, tabs)
        fn(g, bx, by, bw, bh)
        yy = cap_h - 9
        for ln in _wrap(caption, int(pw / 3.3)):
            txt(g, x + pw / 2, yy, ln, caption_size, MUTED, False, 'middle')
            yy -= 9
    d.add(g)
    return d


STAFF_TABS_HEAD = [('Home', True), ('Time', False), ('Stud', False), ('Staff', False), ('More', False)]
STAFF_TABS_TEA = [('Home', True), ('Time', False), ('Stud', False), ('More', False)]
STU_TABS = [('Home', True), ('Result', False), ('Rank', False), ('Teach', False), ('You', False)]


def _hdr(g, bx, by, bw, bh, name, role, accent=BLUE, bell=True):
    top = by + bh
    g.add(Rect(bx, top - 20, 17, 17, rx=5, ry=5, fillColor=accent, strokeColor=None))
    txt(g, bx + 8.5, top - 14, name[0], 8, colors.white, True, 'middle')
    txt(g, bx + 21, top - 9, name, 7, DARK, True)
    txt(g, bx + 21, top - 17, role, 5.6, MUTED)
    if bell:
        glyph(g, bx + bw - 12, top - 19, 11, 'bell', MUTED)
        dot(g, bx + bw - 3, top - 8, 2, RED)
    return top - 26


# ------------------------------------------------------------ head home ----
def head_home(g, bx, by, bw, bh):
    y = _hdr(g, bx, by, bw, bh, 'Bright Future', 'Head Teacher')
    pill(g, bx, y - 9, 46, 10, 'Main branch', TINT_B, BLUE, 5.4)
    y -= 16
    # two stat tiles
    tw = (bw - 6) / 2
    g.add(Rect(bx, y - 30, tw, 30, rx=6, ry=6, fillColor=BLUE, strokeColor=None))
    txt(g, bx + 7, y - 15, '6', 13, colors.white, True)
    txt(g, bx + 7, y - 25, 'Classes today', 5.4, colors.Color(1, 1, 1, .8))
    card(g, bx + tw + 6, y - 30, tw, 30)
    txt(g, bx + tw + 13, y - 15, '48', 13, DARK, True)
    txt(g, bx + tw + 13, y - 25, 'Students', 5.4, MUTED)
    y -= 36
    # parent reach card
    card(g, bx, y - 44, bw, 44, CARD, BLUE)
    txt(g, bx + 7, y - 12, 'Parent reach - this week', 6.4, DARK, True)
    txt(g, bx + 7, y - 26, '34 of 48', 11, BLUE, True)
    txt(g, bx + bw - 7, y - 25, 'families opened', 5.2, MUTED, False, 'end')
    meter(g, bx + 7, y - 34, bw - 14, 71, BLUE)
    txt(g, bx + 7, y - 41, '14 did not open this week', 5.2, MUTED)
    y -= 53
    txt(g, bx, y, 'Quick actions', 6, MUTED, True)
    y -= 5
    qa = [('check', 'Attend', GREEN, TINT_G), ('chart', 'Results', BLUE, TINT_B),
          ('book', 'Homework', AMBER, TINT_A), ('bell', 'Remind', INDIGO, TINT_I)]
    qw = (bw - 9) / 4
    for i, (ic, lab, fg, bgc) in enumerate(qa):
        x = bx + i * (qw + 3)
        card(g, x, y - 30, qw, 30)
        icon_tile(g, x + qw / 2 - 7, y - 22, 14, ic, fg, bgc, 4)
        txt(g, x + qw / 2, y - 28, lab, 4.8, TEXT, False, 'middle')
    y -= 37
    txt(g, bx, y, "Today's schedule", 6, MUTED, True)
    for t, s in (('09:00', 'Maths - Class 10'), ('11:00', 'Physics - Class 12')):
        y -= 17
        card(g, bx, y, bw, 15)
        txt(g, bx + 6, y + 5, t, 5.6, BLUE, True)
        g.add(Line(bx + 26, y + 3, bx + 26, y + 12, strokeColor=LINE, strokeWidth=0.6))
        txt(g, bx + 31, y + 5, s, 5.8, DARK, True)


# --------------------------------------------------------- teacher home ----
def teacher_home(g, bx, by, bw, bh):
    y = _hdr(g, bx, by, bw, bh, 'Priya Sharma', 'Teacher', INDIGO)
    pill(g, bx, y - 9, 46, 10, 'Main branch', TINT_I, INDIGO, 5.4)
    y -= 16
    tw = (bw - 6) / 2
    g.add(Rect(bx, y - 30, tw, 30, rx=6, ry=6, fillColor=INDIGO, strokeColor=None))
    txt(g, bx + 7, y - 15, '4', 13, colors.white, True)
    txt(g, bx + 7, y - 25, 'Classes today', 5.4, colors.Color(1, 1, 1, .8))
    card(g, bx + tw + 6, y - 30, tw, 30)
    txt(g, bx + tw + 13, y - 15, '48', 13, DARK, True)
    txt(g, bx + tw + 13, y - 25, 'Students', 5.4, MUTED)
    y -= 36
    # parent reach - the same card the head sees
    card(g, bx, y - 44, bw, 44, CARD, INDIGO)
    txt(g, bx + 7, y - 12, 'Parent reach - this week', 6.4, DARK, True)
    txt(g, bx + 7, y - 26, '34 of 48', 11, INDIGO, True)
    txt(g, bx + bw - 7, y - 25, 'families opened', 5.2, MUTED, False, 'end')
    meter(g, bx + 7, y - 34, bw - 14, 71, INDIGO)
    txt(g, bx + 7, y - 41, '14 did not open this week', 5.2, MUTED)
    y -= 53
    txt(g, bx, y, 'Quick actions', 6, MUTED, True)
    y -= 5
    qa = [('check', 'Attend', GREEN, TINT_G), ('chart', 'Results', BLUE, TINT_B),
          ('book', 'Homework', AMBER, TINT_A), ('bell', 'Remind', INDIGO, TINT_I)]
    qw = (bw - 9) / 4
    for i, (ic, lab, fg, bgc) in enumerate(qa):
        x = bx + i * (qw + 3)
        card(g, x, y - 30, qw, 30)
        icon_tile(g, x + qw / 2 - 7, y - 22, 14, ic, fg, bgc, 4)
        txt(g, x + qw / 2, y - 28, lab, 4.8, TEXT, False, 'middle')
    y -= 37
    txt(g, bx, y, "Today's schedule", 6, MUTED, True)
    for t, s in (('09:00', 'Maths - Class 10'), ('14:00', 'Maths - Class 9')):
        y -= 17
        card(g, bx, y, bw, 15)
        txt(g, bx + 6, y + 5, t, 5.6, INDIGO, True)
        g.add(Line(bx + 26, y + 3, bx + 26, y + 12, strokeColor=LINE, strokeWidth=0.6))
        txt(g, bx + 31, y + 5, s, 5.8, DARK, True)


# ------------------------------------------------------------- more menu ----
def _menu(g, bx, y, bw, items, fg, bgc):
    for lab, badge, ic in items:
        y -= 15
        card(g, bx, y, bw, 13)
        icon_tile(g, bx + 3, y + 2, 9, ic, fg, bgc, 3)
        txt(g, bx + 16, y + 4.4, lab, 5.8, DARK, True)
        if badge:
            g.add(Circle(bx + bw - 8, y + 6.5, 4, fillColor=RED, strokeColor=None))
            txt(g, bx + bw - 8, y + 4.6, badge, 5, colors.white, True, 'middle')
    return y


DAILY = [('Student requests', '3', 'person'), ('Mark attendance', None, 'check'),
         ('Enter results', None, 'chart'), ('Assignments', None, 'book'),
         ('Study material', None, 'book'), ('Send reminders', None, 'bell')]
MGMT = [('Staff access', '2', 'person'), ('Weekly report', None, 'chart'),
        ('Fees & alerts', None, 'rupee'), ('Rankings', None, 'trophy'),
        ('Meetings', None, 'clock'), ('Branches', None, 'building')]


def head_more(g, bx, by, bw, bh):
    y = by + bh - 4
    txt(g, bx, y, 'DAILY', 5.4, MUTED, True)
    y = _menu(g, bx, y - 2, bw, DAILY, BLUE, TINT_B)
    y -= 12
    txt(g, bx, y, 'MANAGEMENT', 5.4, BLUE, True)
    g.add(Rect(bx - 3, y - 96, bw + 6, 104, rx=6, ry=6, fillColor=None,
               strokeColor=BLUE, strokeWidth=0.8, strokeDashArray=[2.5, 2]))
    _menu(g, bx, y - 2, bw, MGMT, BLUE, TINT_B)


def teacher_more(g, bx, by, bw, bh):
    y = by + bh - 4
    txt(g, bx, y, 'DAILY', 5.4, MUTED, True)
    y = _menu(g, bx, y - 2, bw, DAILY, INDIGO, TINT_I)
    y -= 14
    g.add(Rect(bx, y - 44, bw, 46, rx=6, ry=6, fillColor=None,
               strokeColor=FAINT, strokeWidth=0.7, strokeDashArray=[2, 2]))
    txt(g, bx + bw / 2, y - 16, 'the entire', 6, FAINT, False, 'middle')
    txt(g, bx + bw / 2, y - 26, 'management block', 6.4, FAINT, True, 'middle')
    txt(g, bx + bw / 2, y - 36, 'is not here', 6, FAINT, False, 'middle')


# --------------------------------------------------------- student home ----
def stu_home(g, bx, by, bw, bh):
    y = _hdr(g, bx, by, bw, bh, 'Bright Future', 'Aarav - Class 10', GREEN)
    y -= 4
    tw = (bw - 6) / 2
    g.add(Rect(bx, y - 34, tw, 34, rx=6, ry=6, fillColor=BLUE, strokeColor=None))
    ring(g, bx + 13, y - 17, 8, 92, colors.white, colors.Color(1, 1, 1, .25),
         '92%', None, 3.2)
    txt(g, bx + 24, y - 14, 'Attendance', 4.3, colors.Color(1, 1, 1, .9), True)
    txt(g, bx + 24, y - 21, 'this term', 4.6, colors.Color(1, 1, 1, .7))
    card(g, bx + tw + 6, y - 34, tw, 34)
    txt(g, bx + tw + 13, y - 17, '#4', 13, AMBER, True)
    txt(g, bx + tw + 13, y - 27, 'Rank in Maths', 5.2, MUTED)
    y -= 41
    txt(g, bx, y, 'Everything about you', 6, MUTED, True)
    y -= 4
    tiles = [('chart', 'Results', BLUE, TINT_B), ('book', 'Homework', AMBER, TINT_A),
             ('clock', 'Timetable', INDIGO, TINT_I), ('rupee', 'Fees', GREEN, TINT_G),
             ('person', 'Teachers', BLUE, TINT_B), ('bell', 'Alerts', RED, TINT_R)]
    tw2 = (bw - 6) / 3
    for i, (ic, lab, fg, bgc) in enumerate(tiles):
        col, row = i % 3, i // 3
        x = bx + col * (tw2 + 3)
        yy = y - 30 - row * 33
        card(g, x, yy, tw2, 30)
        icon_tile(g, x + tw2 / 2 - 7, yy + 12, 14, ic, fg, bgc, 4)
        txt(g, x + tw2 / 2, yy + 5, lab, 5, TEXT, False, 'middle')
    y -= 70
    txt(g, bx, y, "Today's classes", 6, MUTED, True)
    for t, s in (('09:00', 'Maths - Room 2'), ('11:00', 'Physics - Room 1')):
        y -= 17
        card(g, bx, y, bw, 15)
        txt(g, bx + 6, y + 5, t, 5.6, BLUE, True)
        g.add(Line(bx + 26, y + 3, bx + 26, y + 12, strokeColor=LINE, strokeWidth=0.6))
        txt(g, bx + 31, y + 5, s, 5.8, DARK, True)


# --------------------------------------------------- student attendance ----
def stu_attendance(g, bx, by, bw, bh):
    y = by + bh
    g.add(Rect(bx, y - 56, bw, 56, rx=7, ry=7, fillColor=BLUE, strokeColor=None))
    ring(g, bx + 27, y - 28, 17, 92, colors.white, colors.Color(1, 1, 1, .25),
         '92%', 'Present', 6)
    txt(g, bx + 50, y - 20, 'Present overall', 6.4, colors.white, True)
    txt(g, bx + 50, y - 30, '46 of 50 class days', 5.4, colors.Color(1, 1, 1, .8))
    txt(g, bx + 50, y - 38, 'attended.', 5.4, colors.Color(1, 1, 1, .8))
    txt(g, bx + 50, y - 48, '3 absences, 1 leave', 5.4, colors.Color(1, 1, 1, .8))
    y -= 64
    txt(g, bx, y, 'Recent days', 6.4, DARK, True)
    rows = [('Monday', '26 Aug', 'Present', GREEN, TINT_G),
            ('Friday', '23 Aug', 'Present', GREEN, TINT_G),
            ('Thursday', '22 Aug', 'Absent', RED, TINT_R),
            ('Wednesday', '21 Aug', 'Present', GREEN, TINT_G),
            ('Tuesday', '20 Aug', 'Leave', AMBER, TINT_A),
            ('Monday', '19 Aug', 'Present', GREEN, TINT_G)]
    for day, date, st, col, tint in rows:
        y -= 19
        card(g, bx, y, bw, 17)
        icon_tile(g, bx + 4, y + 3, 11, 'check' if st == 'Present' else 'clock', col, tint, 3)
        txt(g, bx + 19, y + 9, day, 5.8, DARK, True)
        txt(g, bx + 19, y + 3, date, 5, MUTED)
        txt(g, bx + bw - 5, y + 6, st, 5.6, col, True, 'end')


# ------------------------------------------------------ student results ----
def stu_results(g, bx, by, bw, bh):
    y = by + bh
    txt(g, bx, y - 10, 'Test Results', 10, DARK, True)
    y -= 22
    tw = (bw - 6) / 2
    g.add(Rect(bx, y - 30, tw, 30, rx=6, ry=6, fillColor=TINT_G, strokeColor=None))
    txt(g, bx + tw / 2, y - 17, 'A', 14, GREEN, True, 'middle')
    txt(g, bx + tw / 2, y - 26, 'Overall grade', 5, GREEN, False, 'middle')
    card(g, bx + tw + 6, y - 30, tw, 30)
    txt(g, bx + tw + 6 + tw / 2, y - 17, '84%', 13, DARK, True, 'middle')
    txt(g, bx + tw + 6 + tw / 2, y - 26, 'Average', 5, MUTED, False, 'middle')
    y -= 38
    txt(g, bx, y, 'All subjects', 6.4, DARK, True)
    rows = [('Mathematics', 'Unit Test 3', '46/50', 92, 'A', GREEN, TINT_G),
            ('Physics', 'Unit Test 3', '41/50', 82, 'A', GREEN, TINT_G),
            ('Chemistry', 'Unit Test 2', '36/50', 72, 'B', BLUE, TINT_B),
            ('English', 'Unit Test 3', '43/50', 86, 'A', GREEN, TINT_G),
            ('Biology', 'Unit Test 1', '29/50', 58, 'C', AMBER, TINT_A)]
    for sub, test, mk, pct, gr, col, tint in rows:
        y -= 28
        card(g, bx, y, bw, 26)
        pill(g, bx + 5, y + 14, 13, 9, gr, tint, col, 5.6)
        txt(g, bx + 22, y + 17, sub, 5.8, DARK, True)
        txt(g, bx + 22, y + 10, test, 4.8, MUTED)
        txt(g, bx + bw - 5, y + 15, mk, 5.8, DARK, True, 'end')
        meter(g, bx + 5, y + 4, bw - 10, pct, col, SOFT, 3.4)


# --------------------------------------------------------- student fees ----
def stu_fees(g, bx, by, bw, bh):
    y = by + bh
    g.add(Rect(bx, y - 52, bw, 52, rx=7, ry=7, fillColor=RED, strokeColor=None))
    txt(g, bx + 8, y - 13, 'Amount due', 5.4, colors.Color(1, 1, 1, .75))
    txt(g, bx + 8, y - 27, 'Rs 2,500', 15, colors.white, True)
    txt(g, bx + 8, y - 36, 'August 2026  -  Due 5 Sep', 5.4, colors.Color(1, 1, 1, .85))
    g.add(Rect(bx + 8, y - 48, bw - 16, 10, rx=5, ry=5, fillColor=colors.white, strokeColor=None))
    txt(g, bx + bw / 2, y - 45, 'Pay now', 5.8, RED, True, 'middle')
    y -= 60
    txt(g, bx, y, 'Payment history', 6.4, DARK, True)
    for per, dt, amt in (('July 2026', '4 Jul', 'Rs 2,500'), ('June 2026', '3 Jun', 'Rs 2,500'),
                         ('May 2026', '6 May', 'Rs 2,500'), ('April 2026', '2 Apr', 'Rs 2,500')):
        y -= 19
        card(g, bx, y, bw, 17)
        icon_tile(g, bx + 4, y + 3, 11, 'check', GREEN, TINT_G, 3)
        txt(g, bx + 19, y + 9, per, 5.8, DARK, True)
        txt(g, bx + 19, y + 3, 'Paid on ' + dt, 5, MUTED)
        txt(g, bx + bw - 5, y + 6, amt, 5.6, GREEN, True, 'end')
    y -= 26
    g.add(Rect(bx, y, bw, 22, rx=6, ry=6, fillColor=TINT_G, strokeColor=None))
    txt(g, bx + bw / 2, y + 13, 'All clear!', 8, GREEN, True, 'middle')
    txt(g, bx + bw / 2, y + 5, 'what you see with nothing due', 4.8, GREEN, False, 'middle')


# ------------------------------------------------------- lock screen -------
def lockscreen(g, bx, by, bw, bh):
    y = by + bh
    txt(g, bx + bw / 2, y - 16, '7:42', 20, DARK, True, 'middle')
    txt(g, bx + bw / 2, y - 26, 'Thursday 3 September', 5.6, MUTED, False, 'middle')
    y -= 40
    notes = [('New results published', 'Mathematics - Unit Test 3 is out', 'chart', BLUE, TINT_B),
             ('Aarav was marked absent', 'Today, 09:00 - Maths', 'clock', RED, TINT_R),
             ('New homework', 'Physics - due Friday', 'book', AMBER, TINT_A),
             ('Fee reminder', 'Rs 2,500 due on 5 September', 'rupee', GREEN, TINT_G)]
    for title, sub, ic, fg, tint in notes:
        y -= 34
        card(g, bx, y, bw, 32, CARD, LINE, 7)
        icon_tile(g, bx + 5, y + 17, 11, ic, fg, tint, 3)
        txt(g, bx + 19, y + 20, 'Second Skool', 4.8, MUTED, True)
        txt(g, bx + bw - 5, y + 20, 'now', 4.6, FAINT, False, 'end')
        txt(g, bx + 5, y + 11, title, 5.8, DARK, True)
        txt(g, bx + 5, y + 4, sub, 5.2, MUTED)

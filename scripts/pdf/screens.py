# -*- coding: utf-8 -*-
"""Phone mockups of the real Second Skool screens, drawn in the app's Register look."""
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing, Rect, Circle, Line, Group
from viz import (card, txt, mono, tag, meter, dot, icon_tile, glyph, phone_shell,
                 _wrap, BLUE, DARK, TEXT, MUTED, FAINT, LINE, BORDER, CARD, GREEN,
                 AMBER, RED, TINT_B, TINT_G, TINT_A, TINT_R, ON_G, ON_A, ON_R)

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


def tabs(labels, active=0, alert=None):
    return [(lab, i == active, lab == alert) for i, lab in enumerate(labels)]


STAFF_TABS_HEAD = tabs(['Home', 'Timetable', 'Students', 'Staff', 'More'], alert='More')
STAFF_TABS_TEA = tabs(['Home', 'Timetable', 'Students', 'More'], alert='More')
STU_LABELS = ['Home', 'Results', 'Ranking', 'Teachers', 'Profile']
STU_TABS = tabs(STU_LABELS)


# --------------------------------------------------------------- atoms ----
def _h2(g, bx, y, bw, label):
    """td-h2: an ink rule, an uppercase caption, a hairline. Returns the y below."""
    g.add(Line(bx, y, bx + bw, y, strokeColor=DARK, strokeWidth=1.1))
    txt(g, bx, y - 6.6, label.upper(), 4.5, MUTED, True)
    _rule(g, bx, y - 9, bw)
    return y - 9


def _rule(g, bx, y, bw):
    g.add(Line(bx, y, bx + bw, y, strokeColor=LINE, strokeWidth=0.6))


def _split(g, x, y, w, pct, h=2.4):
    """The app's attendance bar: green for present, red for the rest."""
    cut = w * pct / 100.0
    g.add(Rect(x, y, cut, h, fillColor=GREEN, strokeColor=None))
    g.add(Rect(x + cut, y, w - cut, h, fillColor=RED, strokeColor=None))


def _avatar(g, cx, cy, r, initials, fill=DARK, fg=colors.white):
    g.add(Circle(cx, cy, r, fillColor=fill, strokeColor=None))
    txt(g, cx, cy - r * .36, initials, r * .95, fg, True, 'middle')


def _bell(g, x, y):
    glyph(g, x, y, 9, 'bell', MUTED)
    dot(g, x + 8.4, y + 8.2, 1.3, RED)


def _big(g, bx, y, value, color=DARK):
    mono(g, bx, y - 13, value, 15, color)


def _branch(g, bx, y, bw):
    glyph(g, bx, y - 6, 6, 'building', MUTED)
    txt(g, bx + 8, y - 5, 'Main branch', 5, DARK, True)
    txt(g, bx + bw, y - 5, 'updated 2m ago', 4.4, FAINT, False, 'end')
    return y - 11


# ----------------------------------------------------------- staff home ----
def _staff_hdr(g, bx, by, bw, bh, name, sub, initials):
    top = by + bh
    txt(g, bx, top - 8, name, 7.2, DARK, True)
    mono(g, bx, top - 15.5, sub, 4.3, MUTED)
    _bell(g, bx + bw - 27, top - 15)
    _avatar(g, bx + bw - 6, top - 10, 6, initials)
    return top - 22


def _attendance_today(g, bx, y, bw):
    y = _h2(g, bx, y, bw, 'Today · attendance')
    _big(g, bx, y - 2, '92%')
    txt(g, bx + bw, y - 9, '44 present', 4.8, ON_G, True, 'end')
    txt(g, bx + bw, y - 15, '4 absent', 4.8, ON_R, True, 'end')
    _split(g, bx, y - 22, bw, 92)
    return y - 29


def _attention(g, bx, y, bw, rows):
    y = _h2(g, bx, y, bw, 'Needs attention')
    for i, (name, sub, label, fill, fg) in enumerate(rows):
        mono(g, bx, y - 7.5, '%02d' % (i + 1), 4.6, FAINT)
        txt(g, bx + 10, y - 7, name, 5.5, DARK, True)
        txt(g, bx + 10, y - 13, sub, 4.5, MUTED)
        tag(g, bx + bw, y - 10, label, fill, fg, 3.8)
        y -= 16
        _rule(g, bx, y, bw)
    return y


def _parents(g, bx, y, bw):
    y = _h2(g, bx, y, bw, 'Parents · this week')
    mono(g, bx, y - 10, '34 of 48', 8.6, DARK)
    txt(g, bx + 45, y - 9.5, 'families opened the app', 4.5, MUTED)
    meter(g, bx, y - 15, bw, 71, BLUE, LINE, 1.8)
    x = bx
    for chip in ('6 never opened', '5 opened once', '3 gone quiet'):
        w = len(chip) * 1.95 + 5
        card(g, x, y - 25.5, w, 7.5, CARD, BORDER, 1, 0.5)
        txt(g, x + w / 2, y - 23.3, chip, 3.8, TEXT, False, 'middle')
        x += w + 2.5
    return y - 30


def _quick(g, bx, y, bw):
    """The 2x2 quick-action grid: white cells on a border-coloured ground."""
    ch, cw = 13, (bw - 1) / 2
    g.add(Rect(bx, y - 2 * ch - 1, bw, 2 * ch + 1, fillColor=BORDER, strokeColor=None))
    items = [('check', 'Attendance'), ('chart', 'Results'), ('book', 'Assignment'), ('bell', 'Reminder')]
    for i, (ic, lab) in enumerate(items):
        x, yy = bx + (i % 2) * (cw + 1), y - (i // 2 + 1) * (ch + .5)
        g.add(Rect(x + .5, yy + .5, cw - 1, ch - 1, fillColor=CARD, strokeColor=None))
        glyph(g, x + 4, yy + 3, 7, ic, DARK)
        txt(g, x + 14, yy + 4.6, lab, 5, DARK, True)


def head_home(g, bx, by, bw, bh):
    y = _staff_hdr(g, bx, by, bw, bh, 'Good morning', 'Thu 18 Sep · 6 classes', 'SM')
    y = _branch(g, bx, y, bw)
    y = _attendance_today(g, bx, y, bw)
    y = _h2(g, bx, y, bw, 'Fees')
    hw = bw / 2
    card(g, bx, y - 19, bw, 17, CARD, BORDER, 1)
    g.add(Line(bx + hw, y - 19, bx + hw, y - 2, strokeColor=BORDER, strokeWidth=0.6))
    for x, cap, amt, fg in ((bx, 'COLLECTED', 'Rs 84,500', ON_G), (bx + hw, 'DUE', 'Rs 12,000', ON_R)):
        txt(g, x + 4, y - 7.5, cap, 3.8, MUTED, True)
        mono(g, x + 4, y - 15, amt, 6, fg)
    y = _attention(g, bx, y - 22, bw, [
        ('Rohan Mehta', 'Fee overdue by 9 days', 'overdue', TINT_R, ON_R),
        ('Class 10 Maths', 'Attendance not marked', 'today', TINT_A, ON_A)])
    y = _parents(g, bx, y - 3, bw)
    _quick(g, bx, y - 2, bw)


def teacher_home(g, bx, by, bw, bh):
    y = _staff_hdr(g, bx, by, bw, bh, 'Good morning', 'Thu 18 Sep · 3 classes', 'NP')
    y = _branch(g, bx, y, bw)
    y = _attendance_today(g, bx, y, bw)
    y = _attention(g, bx, y - 3, bw, [
        ('Class 9 Science', 'Attendance not marked', 'today', TINT_A, ON_A),
        ('Isha Patel', 'Absent 3 days in a row', 'absent', TINT_R, ON_R)])
    y = _parents(g, bx, y - 3, bw)
    y = _h2(g, bx, y - 3, bw, "Today's schedule")
    for t, cls in (('16:00', 'Class 10 · Maths'), ('17:30', 'Class 9 · Science')):
        mono(g, bx, y - 8, t, 5, MUTED)
        txt(g, bx + 20, y - 8, cls, 5.3, DARK, True)
        y -= 12
        _rule(g, bx, y, bw)


# ------------------------------------------------------------- more menu ----
def _menu(g, bx, y, bw, items):
    for lab, badge, ic in items:
        y -= 14
        card(g, bx, y, bw, 12.5, CARD, LINE, 1.5)
        icon_tile(g, bx + 2.5, y + 2, 8.5, ic, BLUE, TINT_B, 1.2)
        txt(g, bx + 15, y + 4.4, lab, 5.6, DARK, True)
        if badge:
            g.add(Circle(bx + bw - 7, y + 6.25, 3.4, fillColor=RED, strokeColor=None))
            txt(g, bx + bw - 7, y + 4.6, badge, 4.4, colors.white, True, 'middle')
    return y


DAILY = [('Student requests', '3', 'person'), ('Mark attendance', None, 'check'),
         ('Enter results', None, 'chart'), ('Assignments', None, 'book'),
         ('Study material', None, 'book'), ('Send reminders', None, 'bell')]
MGMT = [('Staff access', '2', 'person'), ('Weekly report', None, 'chart'),
        ('Fees & alerts', None, 'rupee'), ('Rankings', None, 'trophy'),
        ('Meetings', None, 'clock'), ('Branches', None, 'building')]


def head_more(g, bx, by, bw, bh):
    y = _menu(g, bx, by + bh - 2, bw, DAILY)
    txt(g, bx, y - 9, 'Management', 5.2, MUTED, True)
    _menu(g, bx, y - 11, bw, MGMT)


def teacher_more(g, bx, by, bw, bh):
    y = _menu(g, bx, by + bh - 2, bw, DAILY) - 10
    g.add(Rect(bx, y - 40, bw, 40, rx=1.5, ry=1.5, fillColor=None,
               strokeColor=FAINT, strokeWidth=0.6, strokeDashArray=[2, 2]))
    txt(g, bx + bw / 2, y - 15, 'no Management section', 5.4, FAINT, True, 'middle')
    txt(g, bx + bw / 2, y - 25, 'staff, fees and reports', 5, FAINT, False, 'middle')
    txt(g, bx + bw / 2, y - 32, 'stay with the head', 5, FAINT, False, 'middle')


# --------------------------------------------------------- student home ----
def stu_home(g, bx, by, bw, bh):
    top = by + bh
    _avatar(g, bx + 6, top - 10, 6, 'AS', TINT_B, BLUE)
    txt(g, bx + 16, top - 8, 'Aarav Shah', 7, DARK, True)
    mono(g, bx + 16, top - 15.5, 'Class 10 · Bright Future', 4.1, MUTED)
    _bell(g, bx + bw - 9, top - 15)
    y = top - 22
    g.add(Rect(bx, y - 16, bw, 16, rx=1.5, ry=1.5, fillColor=TINT_R, strokeColor=None))
    txt(g, bx + 5, y - 7, 'Fee of Rs 2,500 is due', 5.6, ON_R, True)
    txt(g, bx + 5, y - 13, 'Pay by 5 Sep', 4.6, ON_R)
    y = _branch(g, bx, y - 19, bw)
    y = _h2(g, bx, y, bw, 'Attendance')
    _big(g, bx, y - 2, '92%')
    txt(g, bx + bw, y - 9, '46 sessions marked', 4.5, MUTED, False, 'end')
    txt(g, bx + bw, y - 15, '18 of 20 this month', 4.5, MUTED, False, 'end')
    _split(g, bx, y - 22, bw, 92)
    y = _h2(g, bx, y - 28, bw, 'Standing')
    for lab, val in (('Class rank', '#4 / 32'), ('Tests this month', '3 · avg 84%')):
        txt(g, bx, y - 8, lab, 5.3, TEXT)
        mono(g, bx + bw, y - 8, val, 5.3, DARK, 'end')
        y -= 12
        _rule(g, bx, y, bw)
    y -= 4
    tw = (bw - 6) / 3
    for i, (ic, lab) in enumerate((('clock', 'Timetable'), ('book', 'Homework'), ('book', 'Material'))):
        x = bx + i * (tw + 3)
        card(g, x, y - 22, tw, 22, CARD, BORDER, 1.5)
        glyph(g, x + tw / 2 - 4, y - 12, 8, ic, DARK)
        txt(g, x + tw / 2, y - 19, lab, 4.5, DARK, True, 'middle')
    dot(g, x + tw - 4, y - 4, 2, RED)
    y = _h2(g, bx, y - 26, bw, 'Latest marks')
    for sub, mk in (('Mathematics', '46'), ('Physics', '41')):
        txt(g, bx, y - 8, sub, 5.3, DARK, True)
        mono(g, bx + bw - 14, y - 8, mk + '/50', 5, DARK, 'end')
        tag(g, bx + bw, y - 9.5, 'A', TINT_G, ON_G, 4)
        y -= 12
        _rule(g, bx, y, bw)


# ------------------------------------------------------ student screens ----
def stu_attendance(g, bx, by, bw, bh):
    y = _h2(g, bx, by + bh - 1, bw, 'Present overall')
    _big(g, bx, y - 2, '92%')
    txt(g, bx + 40, y - 9, '46 of 50 class days', 4.8, DARK, True)
    txt(g, bx + 40, y - 15, '3 absences, 1 leave', 4.5, MUTED)
    _split(g, bx, y - 22, bw, 92)
    y = _h2(g, bx, y - 30, bw, 'Recent days')
    days = [('Thursday', '18 Sep', 'Present', 'check', TINT_G, ON_G),
            ('Wednesday', '17 Sep', 'Present', 'check', TINT_G, ON_G),
            ('Tuesday', '16 Sep', 'Absent', 'clock', TINT_R, ON_R),
            ('Monday', '15 Sep', 'Present', 'check', TINT_G, ON_G),
            ('Saturday', '13 Sep', 'Leave', 'clock', TINT_A, ON_A),
            ('Friday', '12 Sep', 'Present', 'check', TINT_G, ON_G)]
    for day, date, st, ic, tint, fg in days:
        icon_tile(g, bx, y - 14, 11, ic, fg, tint, 1.2)
        txt(g, bx + 15, y - 7.5, day, 5.4, DARK, True)
        mono(g, bx + 15, y - 13, date, 4.3, MUTED)
        txt(g, bx + bw, y - 10, st, 5.2, fg, True, 'end')
        y -= 17
        _rule(g, bx, y, bw)


def stu_results(g, bx, by, bw, bh):
    y = by + bh
    mono(g, bx, y - 4, 'Class 10 · Bright Future', 4.3, MUTED)
    y = _h2(g, bx, y - 9, bw, 'Average')
    _big(g, bx, y - 2, '84%')
    tag(g, bx + 58, y - 13, 'Grade A', TINT_G, ON_G, 4.2)
    y = _h2(g, bx, y - 21, bw, 'All subjects')
    tone = {'A': (TINT_G, ON_G, GREEN), 'B': (TINT_B, BLUE, BLUE), 'C': (TINT_A, ON_A, AMBER)}
    for name, mk, gr in (('Mathematics', 46, 'A'), ('Physics', 41, 'A'), ('Chemistry', 36, 'B'),
                         ('English', 43, 'A'), ('Biology', 29, 'C')):
        fill, fg, bar = tone[gr]
        txt(g, bx, y - 7.5, name, 5.5, DARK, True)
        mono(g, bx, y - 13.5, 'Unit test 3 · 12 Sep', 3.9, MUTED)
        mono(g, bx + bw - 22, y - 9, str(mk), 7, DARK, 'end')
        mono(g, bx + bw - 12, y - 9, '/50', 4.5, MUTED, 'end')
        tag(g, bx + bw, y - 10, gr, fill, fg, 4)
        meter(g, bx, y - 19, bw, mk * 2, bar, LINE, 1.2)
        y -= 24
        _rule(g, bx, y, bw)


def stu_fees(g, bx, by, bw, bh):
    y = by + bh - 1
    card(g, bx, y - 50, bw, 50, CARD, BORDER, 1.5)
    txt(g, bx + 6, y - 9, 'AMOUNT DUE', 4.4, MUTED, True)
    mono(g, bx + 6, y - 23, 'Rs 2,500', 12, ON_R)
    mono(g, bx + 6, y - 31, 'August 2026 · Due 5 Sep', 4.2, MUTED)
    g.add(Rect(bx + 6, y - 45, bw - 12, 10, rx=1.5, ry=1.5, fillColor=DARK, strokeColor=None))
    txt(g, bx + bw / 2, y - 41.5, 'Pay now', 5.6, colors.white, True, 'middle')
    y = _h2(g, bx, y - 57, bw, 'Payment history')
    for period, paid in (('July 2026', '4 Jul'), ('June 2026', '3 Jun'), ('May 2026', '6 May')):
        txt(g, bx, y - 7.5, period, 5.5, DARK, True)
        mono(g, bx, y - 13.5, 'Paid on ' + paid, 4.2, MUTED)
        mono(g, bx + bw, y - 10, 'Rs 2,500', 5.4, ON_G, 'end')
        y -= 17
        _rule(g, bx, y, bw)
    y -= 10
    g.add(Rect(bx, y - 24, bw, 24, rx=1.5, ry=1.5, fillColor=TINT_G, strokeColor=None))
    txt(g, bx + bw / 2, y - 11, 'All clear', 7.4, ON_G, True, 'middle')
    txt(g, bx + bw / 2, y - 19, 'what you see when nothing is due', 4.4, ON_G, False, 'middle')


# ------------------------------------------------------- lock screen -------
def lockscreen(g, bx, by, bw, bh):
    y = by + bh
    txt(g, bx + bw / 2, y - 16, '7:42', 20, DARK, True, 'middle')
    txt(g, bx + bw / 2, y - 26, 'Thursday 18 September', 5.6, MUTED, False, 'middle')
    y -= 40
    notes = [('New results published', 'Mathematics - Unit test 3 is out', 'chart', BLUE, TINT_B),
             ('Aarav was marked absent', 'Today, 16:00 - Maths', 'clock', ON_R, TINT_R),
             ('New homework', 'Physics - due Friday', 'book', ON_A, TINT_A),
             ('Fee reminder', 'Rs 2,500 due on 5 September', 'rupee', ON_G, TINT_G)]
    for title, sub, ic, fg, tint in notes:
        y -= 34
        card(g, bx, y, bw, 32, CARD, BORDER, 4)
        icon_tile(g, bx + 5, y + 17, 11, ic, fg, tint, 1.5)
        txt(g, bx + 19, y + 20, 'Second Skool', 4.8, MUTED, True)
        txt(g, bx + bw - 5, y + 20, 'now', 4.6, FAINT, False, 'end')
        txt(g, bx + 5, y + 11, title, 5.8, DARK, True)
        txt(g, bx + 5, y + 4, sub, 5.2, MUTED)

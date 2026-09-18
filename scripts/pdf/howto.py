# -*- coding: utf-8 -*-
"""Second Skool - How to use it. The plain-language guide for people who are not
technical: short steps, big type, pictures of the real screens. Every claim is
taken from the running app; where they disagree, the app is right."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether,
                                Table, TableStyle, CondPageBreak)

import viz
from viz import role_trio, flow, BLUE, DARK, TEXT, MUTED, LINE, SOFT, GREEN, AMBER, INDIGO
import screens as SC
from screens import phone_row, STAFF_TABS_HEAD, STAFF_TABS_TEA, STU_TABS

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'Second-Skool-How-To-Guide.pdf')
CW = 170 * mm
RED = colors.HexColor('#c0392b')

ss = getSampleStyleSheet()


def P(name, **kw):
    base = dict(parent=ss['BodyText'], fontName='Helvetica', fontSize=11, leading=16,
                textColor=TEXT, spaceBefore=0, spaceAfter=7)
    base.update(kw)
    return ParagraphStyle(name, **base)


S = {
    'title': P('title', fontName='Helvetica-Bold', fontSize=32, leading=37, textColor=DARK),
    'sub':   P('sub', fontSize=13, leading=19, textColor=MUTED, spaceAfter=18),
    'h1':    P('h1', fontName='Helvetica-Bold', fontSize=22, leading=27, textColor=DARK, spaceAfter=2),
    'h1sub': P('h1sub', fontSize=11.5, leading=16, textColor=MUTED, spaceAfter=12),
    'h2':    P('h2', fontName='Helvetica-Bold', fontSize=14.5, leading=19, textColor=BLUE,
               spaceBefore=12, spaceAfter=6),
    'body':  P('body'),
    'step':  P('step', spaceAfter=0),
    'num':   P('num', fontName='Helvetica-Bold', fontSize=14, leading=17, textColor=colors.white,
               alignment=1, spaceAfter=0),
    'cap':   P('cap', fontSize=9.5, leading=13, textColor=MUTED, spaceAfter=12),
    'th':    P('th', fontName='Helvetica-Bold', fontSize=10.5, leading=14, textColor=colors.white,
               spaceAfter=0),
    'td':    P('td', fontSize=10.5, leading=14.5, spaceAfter=0),
    'tdb':   P('tdb', fontName='Helvetica-Bold', fontSize=10.5, leading=14.5, textColor=DARK,
               spaceAfter=0),
    'note':  P('note', fontName='Helvetica-Bold', fontSize=11, leading=15, textColor=DARK, spaceAfter=0),
    'noteb': P('noteb', fontSize=10.5, leading=15, textColor=TEXT, spaceAfter=0),
}
PAD = [('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9),
       ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
       ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]


def h1(title, sub, tone=BLUE):
    rule = Table([['']], colWidths=[CW], rowHeights=[3],
                 style=[('BACKGROUND', (0, 0), (-1, -1), tone)])
    return [Paragraph(title, S['h1']), rule, Spacer(1, 8), Paragraph(sub, S['h1sub'])]


def h2(title):
    # keepWithNext cannot hold a heading to a KeepTogether, so reserve room instead.
    return [CondPageBreak(45 * mm), Paragraph(title, S['h2'])]


def steps(items, tone=BLUE):
    """Numbered steps, one per row, a coloured number box on the left."""
    t = Table([[Paragraph(str(i), S['num']), Paragraph(s, S['step'])]
               for i, s in enumerate(items, 1)],
              colWidths=[11 * mm, CW - 11 * mm], hAlign='LEFT')
    t.setStyle(TableStyle(PAD + [('BACKGROUND', (0, 0), (0, -1), tone),
                                 ('LINEBELOW', (0, 0), (-1, -1), 2, colors.white),
                                 ('BACKGROUND', (1, 0), (1, -1), SOFT)]))
    return [KeepTogether(t), Spacer(1, 10)]


def table(header, rows, widths, tone=BLUE, bold_first=True):
    data = [[Paragraph(c, S['th']) for c in header]]
    data += [[Paragraph(r[0], S['tdb' if bold_first else 'td'])] + [Paragraph(c, S['td']) for c in r[1:]]
             for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    t.setStyle(TableStyle(PAD + [('BACKGROUND', (0, 0), (-1, 0), tone),
                                 ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, SOFT]),
                                 ('LINEBELOW', (0, 1), (-1, -1), 0.4, LINE),
                                 ('BOX', (0, 0), (-1, -1), 0.4, LINE)]))
    return [t, Spacer(1, 10)]


def callout(title, body, tone=BLUE):
    t = Table([[Paragraph(title, S['note'])], [Paragraph(body, S['noteb'])]],
              colWidths=[CW - 6], hAlign='LEFT')
    t.setStyle(TableStyle(PAD + [('BACKGROUND', (0, 0), (-1, -1), SOFT),
                                 ('LINEBEFORE', (0, 0), (0, -1), 4, tone),
                                 ('BOTTOMPADDING', (0, 0), (0, 0), 1),
                                 ('TOPPADDING', (0, 1), (0, 1), 1)]))
    return [KeepTogether(t), Spacer(1, 10)]


def figure(drawing, caption):
    return [KeepTogether([drawing, Paragraph(caption, S['cap'])])]


story = []
A = story.append
E = story.extend


def new_page():
    # A trailing spacer that lands on a fresh page would leave it blank before the break.
    if isinstance(story[-1], Spacer):
        story.pop()
    A(PageBreak())

# ---------------------------------------------------------------- cover ----
A(Spacer(1, 16 * mm))
A(Paragraph('Second Skool', S['title']))
A(Paragraph('How to use it &mdash; a simple guide for the head teacher, the teachers and '
            'the parents. No computer knowledge needed.', S['sub']))
E(figure(role_trio(CW), 'Three kinds of people use the same app. Each part of this guide is '
                        'for one of them.'))
E(table(['If you are...', 'Read'],
        [['Starting everything', 'Part 1 &mdash; Getting started (everyone, 2 minutes)'],
         ['The head teacher (owner)', 'Part 2 &mdash; For the head teacher'],
         ['A teacher', 'Part 3 &mdash; For teachers'],
         ['A parent or a student', 'Part 4 &mdash; For parents and students'],
         ['Stuck on something', 'Part 5 &mdash; If something goes wrong']],
        [55 * mm, 115 * mm]))
E(callout('The one idea behind the app',
          'Parents can see everything without asking anyone. The child cannot hide any of it. '
          'And the teacher is never blamed for a message that did not reach home.', GREEN))
new_page()

# ------------------------------------------------------------- part 1 ----
E(h1('Part 1 &mdash; Getting started', 'For everyone. Read this first.'))
E(h2('What is Second Skool?'))
A(Paragraph('It is an app for your tuition centre. It keeps attendance, test marks, homework, '
            'fees and notices in one place, and sends them straight to the parent&rsquo;s phone. '
            'There is nothing to buy or download from the Play Store or App Store &mdash; it opens '
            'in the phone&rsquo;s internet browser, like a website.', S['body']))

E(h2('Put it on your home screen (do this once)'))
A(Paragraph('After this it opens like any other app, and reminders can reach you.', S['body']))
E(table(['On an Android phone', 'On an iPhone'],
        [['Open the Second Skool link in Chrome. Tap <b>Install Second Skool</b> when it '
          'appears. An icon is added to your home screen.',
          'Open the link in <b>Safari</b>. Tap the <b>Share</b> button at the bottom, scroll down, '
          'tap <b>Add to Home Screen</b>, then <b>Add</b>. Open Second Skool from the new icon.']],
        [85 * mm, 85 * mm], GREEN, bold_first=False))

E(h2('The first screen'))
E(table(['Part of the screen', 'Who taps it', 'What they need'],
        [['<b>Staff</b> &mdash; Continue with Google, or Sign in with password',
          'Head teacher and teachers', 'A Google account or an email and password'],
         ['<b>Student or parent</b> &mdash; Open my dashboard',
          'Students and parents', 'Only the student code the centre gave you. No email, '
          'no password.']],
        [70 * mm, 45 * mm, 55 * mm]))

E(h2('Four words you will see'))
E(table(['Word', 'What it means'],
        [['Centre code', 'A short code the head teacher gives to teachers so they can join the '
                         'centre.'],
         ['Student code', 'Each student&rsquo;s own key to their dashboard. Keep it like a house '
                          'key &mdash; do not post it in a group.'],
         ['Batch', 'A class or group, for example &ldquo;Class 10 Morning&rdquo;.'],
         ['Approve', 'Say yes to someone who asked to join. Nobody sees anything until they are '
                     'approved.']],
        [35 * mm, 135 * mm]))
new_page()

# ------------------------------------------------------------- part 2 ----
E(h1('Part 2 &mdash; For the head teacher',
     'You own the centre. You can do everything a teacher can, plus the money, staff and '
     'setup.'))

E(h2('Set up your centre (one time, about 10 minutes)'))
E(figure(flow(CW, [
    ('Sign in', 'Continue with Google under Staff'),
    ('Your details', 'Name, phone, subject, qualification'),
    ('Create', 'Tap Create a centre, type its name'),
    ('Set up', 'More: add Subjects and Batches'),
    ('Share codes', 'Centre code to teachers, student codes to families'),
], BLUE, 52, 3), 'Five steps and your centre is ready. You can add a logo later from My Profile.'))

E(h2('Your screens'))
E(figure(phone_row(CW, [
    (None, STAFF_TABS_HEAD, SC.head_home, 'Home: attendance, fees, what needs you, parent reach.'),
    ('More', SC.tabs(['Home', 'Timetable', 'Students', 'Staff', 'More'], 4), SC.head_more, 'More: daily work on top, your management tools below.'),
]), 'The five buttons along the bottom: Home, Timetable, Students, Staff and More.'))

E(h2('&ldquo;I want to...&rdquo; &mdash; where to tap'))
E(table(['I want to...', 'Tap'],
        [['Let a new teacher in', '<b>More</b>, then <b>Staff access</b>, then <b>Approve</b>'],
         ['Let a new student in', '<b>More</b>, then <b>Student requests</b>. Choose the batch, '
                                  'fee and due date, then confirm.'],
         ['Add a fee or a yearly plan', '<b>More</b>, then <b>Fees &amp; alerts</b>'],
         ['Remind everyone whose fee is due', '<b>More</b>, then <b>Fees &amp; alerts</b>, then '
                                              'the alert button'],
         ['See how the week went', '<b>More</b>, then <b>Weekly report</b>'],
         ['Send a parent their child&rsquo;s report', '<b>Weekly report</b>, <b>Students</b> tab, '
                                                     'then <b>Send to parent</b> (opens WhatsApp)'],
         ['See class rankings', '<b>More</b>, then <b>Rankings</b> (they update by themselves)'],
         ['Plan a parent-teacher meeting', '<b>More</b>, then <b>Meetings</b>'],
         ['Change the timetable', 'The <b>Timetable</b> button at the bottom (only you can edit '
                                  'it)'],
         ['Add a branch, subject or batch', '<b>More</b>, then <b>Branches</b>, <b>Subjects</b> '
                                            'or <b>Batches</b>'],
         ['Change the centre name or logo', '<b>My Profile</b>']],
        [62 * mm, 108 * mm]))

E(h2('Fees in three steps'))
E(steps([
    'Open <b>More</b>, then <b>Fees &amp; alerts</b>, and pick the student.',
    'Choose <b>One fee</b> (amount, month, due date) or <b>Installment plan</b> (the year&rsquo;s '
    'total, how many parts, first due date, how often). The form shows every part before you '
    'save.',
    'When the family pays, tap the <b>Due</b> tag next to their name so it says <b>Paid</b>. '
    'Unpaid fees turn <b>overdue</b> by themselves on the due '
    'date, and the parent sees the next amount due on their phone.',
]))

E(h2('Is it working? Check &ldquo;Parent reach&rdquo;'))
A(Paragraph('On your Home screen, <b>Parent reach &middot; this week</b> shows how many families '
            'opened the app, for example &ldquo;34 of 48&rdquo;. Tap it to see who did not. '
            'Beside each name is a <b>WhatsApp</b> button that sends that family their '
            'child&rsquo;s code in one tap.', S['body']))
E(callout('Tip: check it every Monday',
          'A family that never opens the app never sees an absence. Five WhatsApp taps on Monday '
          'saves five angry phone calls at the end of term.', GREEN))

new_page()

# ------------------------------------------------------------- part 3 ----
E(h1('Part 3 &mdash; For teachers',
     'Five jobs. Nothing to set up. Each one reaches the parents by itself.', INDIGO))

E(h2('Join your centre (one time)'))
E(figure(flow(CW, [
    ('Sign in', 'Continue with Google under Staff'),
    ('Your details', 'Name, phone, subject, qualification'),
    ('Join', 'Tap Join, type the centre code from your head'),
    ('Wait', 'Your head approves you. Tap Check again.'),
], INDIGO, 52, 3), 'Until the head approves you, you see a waiting screen. That is normal.'))

E(figure(phone_row(CW, [
    (None, STAFF_TABS_TEA, SC.teacher_home, 'Home: attendance, what needs you, today\'s classes.'),
    ('More', SC.tabs(['Home', 'Timetable', 'Students', 'More'], 3), SC.teacher_more, 'More: every daily job in one list.'),
]), 'Your screens. Four buttons along the bottom: Home, Timetable, Students and More.'))

E(h2('Mark attendance'))
E(steps([
    'Tap <b>Attendance</b> on the Home screen.',
    'Pick the class at the top.',
    'Everyone starts as present. Tap a name to mark that student absent (tap again to undo).',
    'Tap <b>Save</b>. Parents of absent students get an alert.',
], INDIGO))
E(callout('No internet? Still mark it.',
          'If the signal drops, attendance is saved on your phone. An orange bar shows how many '
          'marks are waiting. When the internet comes back they send by themselves &mdash; you do '
          'not need to do anything, and the date stays the day you marked it.', AMBER))

E(h2('Enter test results'))
E(steps([
    'Tap <b>Results</b>. Pick the class and subject.',
    'Type the test name and the maximum marks (for example 50).',
    'Type each student&rsquo;s marks. The app will not let you type more than the maximum.',
    'Publish. Families are told, and rankings update by themselves.',
], INDIGO))

E(h2('Homework, study material and reminders'))
E(table(['Job', 'What you do'],
        [['Homework', 'Type a title, pick subject, class and due date, add instructions, tap '
                      '<b>Create &amp; notify class</b>.'],
         ['Study material', 'Type a title and note. You can attach a PDF or photo (up to 10 MB) '
                            'or paste a YouTube or Drive link.'],
         ['Reminders', 'Pick one of five ready messages &mdash; Notice, Fees, Homework, Test or '
                       'Absence. Choose who gets it (everyone, today&rsquo;s absentees, or fees '
                       'due), change the words if you like, and send.'],
         ['New students', 'When <b>More</b> shows a red dot, open <b>Student requests</b> and '
                          'approve the waiting student.']],
        [36 * mm, 134 * mm], INDIGO))
E(callout('What only the head teacher does',
          'Fees, reports, rankings, staff, branches, subjects, batches and timetable changes. '
          'You can see the timetable and the student list, but not change them. That is on '
          'purpose &mdash; your time goes to teaching, not to typing.', INDIGO))
new_page()

# ------------------------------------------------------------- part 4 ----
E(h1('Part 4 &mdash; For parents and students',
     'You only look. Nothing here can be changed by the child.', GREEN))

E(h2('Get in (one time)'))
E(steps([
    'Open the Second Skool link on the phone. Under <b>Student or parent</b>, tap <b>Open my '
    'dashboard</b>.',
    'Type the student code the centre gave you.',
    'Tap <b>Allow</b> when the phone asks about notifications. A test alert arrives straight '
    'away, so you know it works.',
    'Put the app on your home screen (see Part 1). You will not need the code on this phone '
    'again.',
], GREEN))
E(callout('Saw &ldquo;Alerts are off&rdquo;?',
          'That yellow box means this phone will not tell you about tests, homework or fees. Tap '
          '<b>Turn on alerts</b>. If the phone blocks it, tap the lock icon next to the web '
          'address, allow Notifications, and come back.', AMBER))

E(figure(phone_row(CW, [
    (None, STU_TABS, SC.stu_home, 'Home: fee due, attendance, rank, latest marks.'),
    ('Attendance', STU_TABS, SC.stu_attendance, 'Attendance: the overall % and every day.'),
    ('Test results', SC.tabs(SC.STU_LABELS, 1), SC.stu_results, 'Results: every test, marks and grade.'),
]), 'What the family sees. The five buttons at the bottom are Home, Results, Ranking, Teachers '
    'and Profile.'))

E(h2('What each screen tells you'))
E(table(['Screen', 'Tells you'],
        [['Attendance', 'How many classes your child came to, and which days they missed.'],
         ['Results', 'Every test: the marks, the grade, and the average.'],
         ['Ranking', 'Where your child stands in each subject.'],
         ['Homework', 'What is due and when. Tap one to read the full instructions.'],
         ['Study material', 'Notes, PDFs and videos the teachers shared.'],
         ['Fees', 'The next amount due and its date, or &ldquo;All clear!&rdquo;, and every '
                  'payment made.'],
         ['Timetable', 'Which class is when, day by day.'],
         ['Teachers', 'Who teaches your child, and their qualifications.'],
         ['Notifications', 'Every message the centre has sent.']],
        [36 * mm, 134 * mm], GREEN))

E(figure(phone_row(CW, [
    ('Fees', STU_TABS, SC.stu_fees, 'Fees: what is owed and what is paid.'),
    ('', None, SC.lockscreen, 'Alerts arrive on the phone by themselves.'),
], pw=126), 'You do not even need to open the app &mdash; absences, results and fee reminders '
            'come to the phone.'))

E(h2('The 2-minute weekly check for parents'))
E(steps([
    'Open <b>Attendance</b>. Any day missed that you did not know about?',
    'Open <b>Results</b>. Is the average going up or down?',
    'Open <b>Homework</b>. Is anything due tomorrow?',
    'Look at <b>Fees</b>. Is anything due soon?',
], GREEN))
E(callout('Your child cannot hide anything',
          'The parent&rsquo;s phone number, the marks and the attendance are all set by the '
          'centre. The child cannot change or delete them. If a detail is wrong, ask the '
          'teacher.', GREEN))
new_page()

# ------------------------------------------------------------- part 5 ----
E(h1('Part 5 &mdash; If something goes wrong', 'Most problems have a one-line fix.', AMBER))
E(table(['Problem', 'What to do'],
        [['Staff: forgot my password, or never set one',
          'On the first screen tap <b>Sign in with password</b>, type your email, then tap '
          '<b>Forgot password, or never set one?</b>. We email you a link to set a new one.'],
         ['Staff: Google sign-in is missing',
          'In the home-screen app, use <b>Sign in with password</b>. Set a password once from '
          '<b>My Profile</b> after signing in with Google in the browser.'],
         ['Teacher: stuck on the waiting screen',
          'Your head teacher has not approved you yet. Ask them, then tap <b>Check again</b>.'],
         ['Family: new phone, or the code does not open',
          'Type the code on the new phone &mdash; it waits for the centre. Ask the teacher to '
          'tap <b>Allow</b> for it under Student requests.'],
         ['Family: lost phone',
          'Tell the centre. They remove the old phone, so nobody else can see your child&rsquo;s '
          'details.'],
         ['Head: a phone you do not recognise',
          'Under <b>Student requests</b>, a phone added this week is marked <b>New</b>. If it is '
          'not the family&rsquo;s, remove it. Removing anything asks &ldquo;are you sure?&rdquo; '
          'first.'],
         ['No alerts arriving',
          'Check the app is on your home screen (Part 1) and that you see no &ldquo;Alerts are '
          'off&rdquo; box.'],
         ['No internet',
          'An orange bar says so. Teachers can still mark attendance; everything else waits '
          'until the signal is back.'],
         ['Anything else',
          'Tap <b>Report a problem</b> (in <b>More</b> for staff, in <b>My Profile</b> for '
          'students). Answer four short questions. The reply comes back inside the app.']],
        [55 * mm, 115 * mm], AMBER))
E(callout('Need a person?',
          'Talk to your tuition centre first &mdash; they can fix most things in one tap. For '
          'anything about the app itself, the sign-in and waiting screens have a <b>Stuck? Message '
          'us on WhatsApp</b> link to Second Skool support.', BLUE))
new_page()

# -------------------------------------------------------- cheat sheet ----
E(h1('One-page cheat sheet', 'Print this page and keep it next to the phone.'))


def card(title, tone, lines):
    t = Table([[Paragraph(title, S['th'])]] + [[Paragraph(ln, S['td'])] for ln in lines],
              colWidths=[CW], hAlign='LEFT')
    t.setStyle(TableStyle(PAD + [('BACKGROUND', (0, 0), (-1, 0), tone),
                                 ('BACKGROUND', (0, 1), (-1, -1), SOFT),
                                 ('LINEBELOW', (0, 1), (-1, -1), 0.4, LINE),
                                 ('TOPPADDING', (0, 1), (-1, -1), 5),
                                 ('BOTTOMPADDING', (0, 1), (-1, -1), 5)]))
    return [KeepTogether(t), Spacer(1, 9)]


E(card('Head teacher', BLUE, [
    '<b>New teacher or student waiting?</b> More, then Staff access or Student requests.',
    '<b>Fees:</b> More, then Fees &amp; alerts. Tap <b>Due</b> to make it <b>Paid</b>.',
    '<b>Every Monday:</b> Home, then Parent reach. WhatsApp the families who did not open it.',
    '<b>Weekly report:</b> More, then Weekly report, then Send to parent.',
]))
E(card('Teacher', INDIGO, [
    '<b>Attendance:</b> everyone starts present. Tap who is absent, then Save.',
    '<b>Results:</b> class, subject, test name, maximum marks, each mark, publish.',
    '<b>Homework and material:</b> title, class, due date. Parents are told by themselves.',
    '<b>No internet?</b> Mark attendance anyway. It sends when the signal is back.',
]))
E(card('Parent or student', GREEN, [
    '<b>Get in:</b> Student or parent, then Open my dashboard, then type the student code.',
    '<b>Allow notifications</b> and put the app on the home screen.',
    '<b>Once a week:</b> Attendance, Results, Homework, Fees. Two minutes.',
    '<b>New or lost phone?</b> Tell the centre. They allow or remove it.',
]))
E(card('Stuck?', AMBER, [
    'Ask your tuition centre first. Then <b>Report a problem</b> inside the app.',
]))


def footer(canv, doc):
    canv.saveState()
    canv.setFont('Helvetica', 8.5)
    canv.setFillColor(MUTED)
    canv.drawString(20 * mm, 12 * mm, 'Second Skool  |  How to use it')
    canv.drawRightString(190 * mm, 12 * mm, str(doc.page))
    canv.setStrokeColor(LINE)
    canv.setLineWidth(0.4)
    canv.line(20 * mm, 15.5 * mm, 190 * mm, 15.5 * mm)
    canv.restoreState()


doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                        topMargin=18 * mm, bottomMargin=20 * mm,
                        title='Second Skool - How to use it', author='Second Skool')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print('written', OUT, os.path.getsize(OUT), 'bytes')

# -*- coding: utf-8 -*-
"""Second Skool - the parent's guide. Every claim comes from the running app."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
                                Table, TableStyle, ListFlowable, ListItem)

import viz
from viz import flow, legend
import screens as SC
from screens import phone_row, STU_TABS

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'Second-Skool-Parent-Guide.pdf')
CW = 170 * mm

BLUE = viz.BLUE
DARK = viz.DARK
TEXT = viz.TEXT
MUTED = viz.MUTED
LINE = viz.LINE
SOFT = viz.SOFT
GREEN = viz.GREEN
AMBER = viz.AMBER
RED = viz.RED
INDIGO = viz.INDIGO

ss = getSampleStyleSheet()


def P(name, **kw):
    base = dict(parent=ss['BodyText'], fontName='Helvetica', fontSize=9.6, leading=14.4,
                textColor=TEXT, alignment=TA_LEFT, spaceBefore=0, spaceAfter=6)
    base.update(kw)
    return ParagraphStyle(name, **base)


S = {
    'title':   P('title', fontName='Helvetica-Bold', fontSize=27, leading=31, textColor=DARK, spaceAfter=6),
    'sub':     P('sub', fontSize=11.5, leading=16, textColor=MUTED, spaceAfter=18),
    'h1':      P('h1', fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=DARK,
                 spaceBefore=6, spaceAfter=3),
    'h1sub':   P('h1sub', fontSize=10, leading=14, textColor=MUTED, spaceAfter=14),
    'h2':      P('h2', fontName='Helvetica-Bold', fontSize=12.5, leading=16, textColor=BLUE,
                 spaceBefore=13, spaceAfter=5),
    'body':    P('body'),
    'bullet':  P('bullet', spaceAfter=3, leading=13.6),
    'small':   P('small', fontSize=8.6, leading=12.4, textColor=MUTED),
    'cap':     P('cap', fontSize=8.4, leading=11.6, textColor=MUTED, spaceBefore=2, spaceAfter=12),
    'th':      P('th', fontName='Helvetica-Bold', fontSize=8.8, leading=11.5, textColor=colors.white, spaceAfter=0),
    'td':      P('td', fontSize=8.8, leading=12, spaceAfter=0),
    'tdb':     P('tdb', fontName='Helvetica-Bold', fontSize=8.8, leading=12, textColor=DARK, spaceAfter=0),
    'note':    P('note', fontSize=9.2, leading=13.4, textColor=DARK, spaceAfter=0),
    'quote':   P('quote', fontName='Helvetica-Oblique', fontSize=9.2, leading=13.4, textColor=MUTED, spaceAfter=0),
    'step':    P('step', fontName='Helvetica-Bold', fontSize=10.2, leading=14, textColor=DARK,
                 spaceBefore=9, spaceAfter=3),
}


def h1(t, sub=None):
    out = [Paragraph(t, S['h1'])]
    out.append(Table([['']], colWidths=[CW], rowHeights=[2],
                     style=TableStyle([('BACKGROUND', (0, 0), (-1, -1), BLUE),
                                       ('LEFTPADDING', (0, 0), (-1, -1), 0),
                                       ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                                       ('TOPPADDING', (0, 0), (-1, -1), 0),
                                       ('BOTTOMPADDING', (0, 0), (-1, -1), 0)])))
    out.append(Spacer(1, 8))
    if sub:
        out.append(Paragraph(sub, S['h1sub']))
    return out


def bullets(items):
    lf = ListFlowable(
        [ListItem(Paragraph(i, S['bullet']), leftIndent=14) for i in items],
        bulletType='bullet', start='circle', bulletFontSize=5, bulletColor=BLUE,
        bulletOffsetY=-1,
        leftIndent=12, spaceBefore=2, spaceAfter=8)
    return [lf, Spacer(1, 2)]


def table(header, rows, widths):
    data = [[Paragraph(c, S['th']) for c in header]]
    for r in rows:
        data.append([Paragraph(r[0], S['tdb'])] + [Paragraph(c, S['td']) for c in r[1:]])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    st = [('BACKGROUND', (0, 0), (-1, 0), BLUE),
          ('VALIGN', (0, 0), (-1, -1), 'TOP'),
          ('LEFTPADDING', (0, 0), (-1, -1), 7),
          ('RIGHTPADDING', (0, 0), (-1, -1), 7),
          ('TOPPADDING', (0, 0), (-1, -1), 6),
          ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
          ('LINEBELOW', (0, 1), (-1, -1), 0.4, LINE),
          ('BOX', (0, 0), (-1, -1), 0.4, LINE)]
    for i in range(1, len(data)):
        if i % 2 == 0:
            st.append(('BACKGROUND', (0, i), (-1, i), SOFT))
    t.setStyle(TableStyle(st))
    return [t, Spacer(1, 10)]


def callout(title, body, tone=BLUE):
    inner = [[Paragraph('<b>%s</b>' % title, S['note'])], [Paragraph(body, S['quote'])]]
    t = Table(inner, colWidths=[164 * mm], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), SOFT),
        ('LINEBEFORE', (0, 0), (0, -1), 2.5, tone),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (0, 0), 8),
        ('BOTTOMPADDING', (0, 0), (0, 0), 2),
        ('TOPPADDING', (0, 1), (0, 1), 0),
        ('BOTTOMPADDING', (0, 1), (0, 1), 8),
    ]))
    return [t, Spacer(1, 10)]


def figure(drawing, caption):
    return [drawing, Paragraph('<b>Figure.</b> ' + caption, S['cap'])]


story = []
A = story.append
E = story.extend

# ---------------------------------------------------------------- cover ----
A(Spacer(1, 18 * mm))
A(Paragraph('Second Skool', S['title']))
A(Paragraph('A guide for parents &mdash; how to see your child&rsquo;s tuition '
            'without having to ask anyone', S['sub']))

E(figure(flow(CW, [
    ('Open the app', 'On any phone or laptop browser'),
    ('Type the code', 'The one the centre gave your child'),
    ('See everything', 'Attendance, marks, fees, homework'),
    ('Get told', 'Alerts arrive without opening the app'),
], BLUE, 52),
  'Four steps, once. After the first time the code is remembered on that phone.'))

E(callout('The promise this app makes to you',
          'You should be able to see everything about your child&rsquo;s tuition without asking '
          'anyone, your child should not be able to hide any of it, and the teacher should never '
          'be the one blamed for a message that never arrived.', GREEN))

E(callout('There is nothing to install from a store',
          'Second Skool is a website that behaves like an app. It opens in Chrome or Safari on any '
          'phone, and you can add it to your home screen so it opens like any other app. It costs '
          'you nothing and asks for no account.'))

A(Spacer(1, 4))
A(Paragraph('This guide uses drawings of the actual screens. What you see on your phone will look '
            'the same, with your child&rsquo;s name and your centre&rsquo;s numbers in place of the '
            'examples here.', S['small']))
A(PageBreak())

# ------------------------------------------------------------- contents ----
E(h1('What is in this guide'))
E(table(['Part', 'Covers'],
        [['1. Getting in', 'The student code, what it is, and what to do if you lose it'],
         ['2. The home screen', 'The four numbers you see the moment you open the app'],
         ['3. Attendance', 'Every day marked, and what a low percentage really means'],
         ['4. Marks', 'Every test, the class average beside it, and the rank'],
         ['5. Fees', 'What is due, what was paid, and when'],
         ['6. Homework and notes', 'What was set, when it is due, what was shared'],
         ['7. Alerts on your phone', 'Turning them on, and what the centre can send'],
         ['8. Your questions', 'Privacy, two children, shared phones, and getting help']],
        [45 * mm, 125 * mm]))

E(callout('One thing to know before you start',
          'Your child does not have a password and never will. Their identity is a short code the '
          'centre issues. That is deliberate: a child who cannot log out of a parent&rsquo;s view '
          'also cannot quietly stop the marks from reaching you.', AMBER))

A(PageBreak())

# --------------------------------------------------------------- part 1 ----
E(h1('Part 1 &mdash; Getting in', 'One code. No password, no email, no sign-up form.'))

A(Paragraph('What the student code is', S['h2']))
A(Paragraph('When your child is enrolled, the tuition centre creates them in Second Skool and the '
            'app generates a short student code for them &mdash; a handful of letters and numbers. '
            'That code <b>is</b> the login. There is no password to remember, no email to verify '
            'and no account to create.', S['body']))

E(figure(flow(CW, [
    ('Centre adds', 'The head or a teacher creates the student'),
    ('Code appears', 'A short code, shown on the student card'),
    ('You type it', 'Once, on your phone. It is remembered'),
    ('It stays', 'Until someone signs out on that phone'),
], GREEN, 52),
  'Where the code comes from. Ask the centre for it if it was never handed to you.'))

A(Paragraph('Signing in on your own phone', S['h2']))
E(bullets([
    'Open the link the centre sent you. The first screen offers three choices &mdash; two are for '
    'teachers. Tap <b>I&rsquo;m a student</b>.',
    'Type the code exactly as it was given. Capitals do not matter.',
    'That is it. Your child&rsquo;s home screen opens.',
]))
A(Paragraph('Do this on your own phone, not only on your child&rsquo;s. The whole point is that you '
            'get your own window into the same information, at the same time, from wherever you are.',
            S['body']))

A(Paragraph('If your child was just enrolled and the app says they are waiting', S['h2']))
A(Paragraph('Some centres let a student register themselves with the centre&rsquo;s join code. When '
            'that happens the student sits in a waiting state until the head teacher approves them, '
            'and until then the app shows a waiting screen with a <b>Check again</b> button and '
            'nothing else. Nobody has lost anything &mdash; the approval simply has not happened yet. '
            'One message to the centre usually clears it the same day.', S['body']))

A(Paragraph('If you lose the code', S['h2']))
A(Paragraph('It is on the <b>My Profile</b> screen inside the app, with a copy button beside it, so '
            'as long as one phone is still signed in you can read it off there. If no phone is signed '
            'in, ask the centre &mdash; they can see it on your child&rsquo;s record. The code cannot '
            'be recovered by email, because there is no email attached to it.', S['body']))

E(callout('Treat the code like a key',
          'Anyone holding it can see your child&rsquo;s attendance, marks and fees. It is not secret '
          'in the way a bank password is, but it is not something to post in a class WhatsApp group '
          'either.', AMBER))

A(PageBreak())

# --------------------------------------------------------------- part 2 ----
E(h1('Part 2 &mdash; The home screen', 'The four numbers that answer most questions before you ask them.'))

E(figure(phone_row(CW, [
    ('Home', STU_TABS, SC.stu_home,
     'Attendance and average on top, then whatever needs attention'),
    ('Attendance', STU_TABS, SC.stu_attendance,
     'Every marked day, month by month'),
    ('Results', STU_TABS, SC.stu_results,
     'Every test, class average printed beside the mark'),
]), 'The three screens most parents open. Nothing here can be edited from a phone.'))

A(Paragraph('What you are looking at', S['h2']))
E(table(['On the home screen', 'What it tells you'],
        [['Attendance this term', 'The percentage of marked days your child was present. Tap it for the day-by-day view.'],
         ['Average', 'The average across every test entered this term, so far.'],
         ['Fees', 'A red card if something is outstanding, with the amount and the due date. Nothing at all when there is nothing due.'],
         ['Homework due', 'Assignments with a due date that has not passed yet.'],
         ['Recent notices', 'Anything the centre has sent lately, newest first.']],
        [45 * mm, 125 * mm]))

A(Paragraph('The five tabs along the bottom', S['h2']))
E(table(['Tab', 'What is behind it'],
        [['Home', 'The summary above.'],
         ['Result', 'Every test, subject by subject, with the class average and the date.'],
         ['Rank', 'Where your child stands in their class. Empty until the teachers have entered results.'],
         ['Teach', 'Which teachers take your child, and for which subject.'],
         ['You', 'The profile: name, grade, the student code, and the contact details the centre holds.']],
        [30 * mm, 140 * mm]))

A(Paragraph('Everything in the app is read-only for you and for your child. Nothing on any of these '
            'screens can be edited, deleted or hidden from a phone. Only the centre can change what '
            'is recorded, and the app shows when it last synced so you always know whether you are '
            'reading fresh numbers.', S['body']))

A(PageBreak())

# --------------------------------------------------------------- part 3 ----
E(h1('Part 3 &mdash; Attendance', 'Marked by the teacher, in class, on the day.'))

A(Paragraph('How a day gets marked', S['h2']))
A(Paragraph('The teacher opens their class list and taps each student present or absent. It takes '
            'well under a minute, which is exactly why it actually gets done every day rather than '
            'being reconstructed at the end of the month. The moment it is saved, it is on your phone.',
            S['body']))

A(Paragraph('Reading the percentage honestly', S['h2']))
E(bullets([
    'The percentage counts <b>marked days only</b>. A holiday, or a day the teacher never opened the '
    'register, is not counted against your child.',
    'A single absence in a short term moves the number a lot. Look at the day list underneath before '
    'reacting to the percentage.',
    'If a day looks wrong, it is a data-entry question for the centre, not something to argue with '
    'your child about. Teachers mark dozens of students in a few minutes and occasionally tap the '
    'wrong row.',
]))

E(callout('What this is really for',
          'Not to catch a child out once. It is so that three missed Tuesdays in a row are visible in '
          'week two, while it is still a conversation, rather than in the report at the end of term '
          'when it has become a habit.', GREEN))

A(Paragraph('You are told the same day', S['h2']))
A(Paragraph('When the teacher saves a register with your child marked absent, the app writes '
            '&ldquo;Marked absent today&rdquo; into their notifications and sends it to every phone '
            'signed in with their code. That happens automatically &mdash; the teacher does not have '
            'to remember to tell anyone. See Part 7 for how to make sure your phone accepts it.',
            S['body']))

A(PageBreak())

# --------------------------------------------------------------- part 4 ----
E(h1('Part 4 &mdash; Marks', 'Every test, and the number that gives it meaning.'))

A(Paragraph('Why the class average is printed next to the mark', S['h2']))
A(Paragraph('Sixty-two out of a hundred means nothing on its own. Sixty-two when the class averaged '
            'forty-one is a good paper; sixty-two when the class averaged eighty-four is a warning. '
            'Second Skool prints both numbers side by side on every single result, so you are never '
            'working out which one it was.', S['body']))

E(table(['On the results screen', 'What it means'],
        [['Subject and test name', 'What the paper was.'],
         ['Marks obtained and total', 'Your child&rsquo;s score.'],
         ['Class average', 'What everyone else scored on the same paper.'],
         ['Date', 'When the test was held.']],
        [50 * mm, 120 * mm]))

A(Paragraph('Rankings', S['h2']))
A(Paragraph('The <b>Rank</b> tab shows where your child sits in their class. It fills itself in from '
            'the results the teachers enter &mdash; until there are results it says &ldquo;No rankings '
            'published yet&rdquo; rather than showing a position. An empty rank tab early in a term is '
            'normal, not a fault.', S['body']))

E(callout('A note on how to use this',
          'The most useful thing on this screen is not the highest mark. It is the shape over time: '
          'a subject that used to be above the class average and now sits below it is worth a '
          'conversation long before the term report says so.', BLUE))

A(PageBreak())

# --------------------------------------------------------------- part 5 ----
E(h1('Part 5 &mdash; Fees', 'What is due, what is paid, and no ambiguity about either.'))

E(figure(phone_row(CW, [
    ('Fees', STU_TABS, SC.stu_fees,
     'What is outstanding on top, the payment history under it'),
    ('', None, SC.lockscreen,
     'The same information reaching a phone with the app closed'),
], pw=126), 'Fees, and what the centre&rsquo;s messages look like when they arrive.'))

A(Paragraph('What the screen shows', S['h2']))
E(bullets([
    'If something is outstanding, a red card at the top carries the <b>amount</b>, the <b>period</b> '
    'it covers and the <b>due date</b>.',
    'If nothing is outstanding, you get a green &ldquo;All clear&rdquo; instead. No card, no doubt.',
    'Below either of those sits the payment history &mdash; every payment the centre has recorded, '
    'with its date.',
    'There is a <b>Pay now</b> button on the red card. Tapping it says &ldquo;Contact your teacher '
    'to arrange payment&rdquo; &mdash; it is a prompt, not a payment gateway.',
]))

A(Paragraph('Payment happens outside the app', S['h2']))
A(Paragraph('Second Skool records fees; it does not collect them. You pay the centre the way you '
            'always have, and the centre marks it as received. The screen is the shared record both '
            'sides can point at, which is the part that was missing before.', S['body']))

E(callout('If a payment you made is not showing',
          'It means the centre has not recorded it yet, not that it was lost. Send them the date and '
          'the amount &mdash; it is a one-tap fix on their side.', AMBER))

A(PageBreak())

# --------------------------------------------------------------- part 6 ----
E(h1('Part 6 &mdash; Homework and study material', 'What was set, and what was shared to help with it.'))

E(table(['Screen', 'What it shows'],
        [['Homework', 'Every assignment with its subject and due date. Tap one to open the full instructions the teacher wrote.'],
         ['Study Material', 'Notes the teachers shared &mdash; a file to open, or a video link to follow.'],
         ['Notifications', 'Everything the centre has ever sent: results, homework, fees, notices, absence alerts. Nothing disappears.'],
         ['My Profile', 'Name, grade, average, the student code with a copy button, and the school, standard, parent contact and address the centre holds.']],
        [40 * mm, 130 * mm]))

A(Paragraph('The honest version of what this does', S['h2']))
A(Paragraph('&ldquo;There was no homework&rdquo; stops being a claim anyone has to take on trust. '
            'The list is on your phone, it carries the due date, and it was written by the teacher '
            'who set it. That is the entire feature, and it removes more arguments than anything '
            'else in the app.', S['body']))

E(callout('What you cannot do here',
          'You cannot submit homework through Second Skool, and you cannot message a teacher inside '
          'it. Work is handed in the way your centre already does it. The app tells you what was set '
          'and when it is due &mdash; it does not replace the classroom.', BLUE))

A(PageBreak())

# --------------------------------------------------------------- part 7 ----
E(h1('Part 7 &mdash; Alerts on your phone',
     'The difference between information that exists and information that reaches you.'))

E(figure(flow(CW, [
    ('Teacher saves', 'A result, a fee, a notice, an absence'),
    ('App is told', 'Immediately, no refresh needed'),
    ('Your phone buzzes', 'Even with the app closed, if alerts are on'),
    ('Tap it', 'Opens straight to the screen it is about'),
], INDIGO, 52),
  'Why turning alerts on matters. Without them you only see things when you remember to look.'))

A(Paragraph('Turning them on', S['h2']))
E(bullets([
    'Open the app and go to <b>Notifications</b>.',
    'Allow notifications when the phone asks. This is the phone&rsquo;s own prompt, not the '
    'app&rsquo;s &mdash; if you dismiss it, the phone will not ask again on its own.',
    'On an iPhone, alerts only work once the app has been added to the home screen. Open the share '
    'menu in Safari and choose <b>Add to Home Screen</b> first, then turn alerts on from there.',
]))

A(Paragraph('If you said no the first time', S['h2']))
A(Paragraph('The phone remembers a refusal and stops asking. You have to reverse it in the '
            'phone&rsquo;s own settings, under notifications for the browser or for Second Skool, '
            'and then reopen the app. Nothing inside the app can override that, by design &mdash; '
            'no website is allowed to.', S['body']))

A(Paragraph('What gets sent', S['h2']))
E(table(['Alert', 'When it fires'],
        [['Result published', 'A test your child sat has been entered.'],
         ['Fee due', 'The centre has raised a fee, or a due date is approaching.'],
         ['Homework set', 'A new assignment with a due date.'],
         ['Notice', 'Anything the centre chooses to announce &mdash; a holiday, a schedule change.'],
         ['Absence', 'Your child was marked absent. Sent automatically the moment the register is saved.']],
        [45 * mm, 125 * mm]))

A(Paragraph('Every one of them is also waiting inside the app on the Notifications screen, so a '
            'missed buzz never means missed information.', S['body']))

A(PageBreak())

# --------------------------------------------------------------- part 8 ----
E(h1('Part 8 &mdash; Your questions'))

A(Paragraph('Can my child change or hide anything?', S['h2']))
A(Paragraph('No. Every screen a student opens is read-only. Marks, attendance and fees are written '
            'by the centre and cannot be edited, deleted or dismissed from a phone. A child can '
            'delete a notification banner off their own lock screen &mdash; but the same message is '
            'still sitting in the Notifications list, and still on your phone.', S['body']))

A(Paragraph('Can I see the app on my phone and my child on theirs at the same time?', S['h2']))
A(Paragraph('Yes. The same code can be used on as many phones as you like, and every one of them '
            'sees the same live information.', S['body']))

A(Paragraph('I have two children at the centre.', S['h2']))
A(Paragraph('They have separate codes. Sign in with one, look, sign out from the profile screen and '
            'sign in with the other. Two children on one phone at the same time is not supported '
            'today.', S['body']))

A(Paragraph('We share a phone with the rest of the family.', S['h2']))
A(Paragraph('The code stays signed in until someone signs out. If the phone passes around the house, '
            'either sign out when you are done, or accept that anyone picking it up can see the same '
            'screens.', S['body']))

A(Paragraph('What does the centre see about me?', S['h2']))
A(Paragraph('Only what you gave them when you enrolled &mdash; your child&rsquo;s name, grade, '
            'school, your contact number and address. The app adds nothing to that. It does not read '
            'your contacts, your photos or your location, and there is no advertising in it.',
            S['body']))

A(Paragraph('Something looks wrong. Who do I tell?', S['h2']))
A(Paragraph('The centre, first &mdash; almost everything that looks wrong is a number typed into the '
            'wrong row, and they can fix it in seconds. If the app itself is misbehaving, there is a '
            '<b>Report a problem</b> option on the profile screen that sends the details straight to '
            'the people who maintain it.', S['body']))

E(callout('One last thing',
          'None of this works if you never open it. The single most useful minute you will spend is '
          'turning the alerts on &mdash; after that, the app comes to you.', GREEN))

A(Spacer(1, 6))
A(Paragraph('Every statement in this guide was taken from the running application, and the screens '
            'drawn throughout it follow the app&rsquo;s own layout and palette. Where the app and '
            'this document ever disagree, the app is right and this page needs updating.', S['small']))


def footer(canv, doc):
    canv.saveState()
    canv.setFont('Helvetica', 7.6)
    canv.setFillColor(MUTED)
    canv.drawString(20 * mm, 12 * mm, 'Second Skool  |  A guide for parents')
    canv.drawRightString(190 * mm, 12 * mm, str(doc.page))
    canv.setStrokeColor(LINE)
    canv.setLineWidth(0.4)
    canv.line(20 * mm, 15.5 * mm, 190 * mm, 15.5 * mm)
    canv.restoreState()


doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=20 * mm, rightMargin=20 * mm,
                        topMargin=18 * mm, bottomMargin=20 * mm,
                        title='Second Skool - A guide for parents',
                        author='Second Skool')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print('written', OUT, os.path.getsize(OUT), 'bytes')

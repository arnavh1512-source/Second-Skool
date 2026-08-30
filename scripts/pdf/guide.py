# -*- coding: utf-8 -*-
"""Second Skool - Complete Feature Guide. Every claim below comes from the code."""
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
from viz import role_trio, flow, legend
import screens as SC
from screens import phone_row, STAFF_TABS_HEAD, STAFF_TABS_TEA, STU_TABS

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'Second-Skool-Complete-Feature-Guide.pdf')
CW = 170 * mm  # content width

BLUE = viz.BLUE
DARK = viz.DARK
TEXT = viz.TEXT
MUTED = viz.MUTED
LINE = viz.LINE
SOFT = viz.SOFT
GREEN = viz.GREEN
AMBER = viz.AMBER
RED = colors.HexColor('#c0392b')
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
    'h3':      P('h3', fontName='Helvetica-Bold', fontSize=10.2, leading=14, textColor=DARK,
                 spaceBefore=9, spaceAfter=3),
    'body':    P('body'),
    'bullet':  P('bullet', spaceAfter=3, leading=13.6),
    'small':   P('small', fontSize=8.6, leading=12.4, textColor=MUTED),
    'cap':     P('cap', fontSize=8.4, leading=11.6, textColor=MUTED, spaceBefore=2, spaceAfter=12),
    'th':      P('th', fontName='Helvetica-Bold', fontSize=8.8, leading=11.5, textColor=colors.white, spaceAfter=0),
    'td':      P('td', fontSize=8.8, leading=12, spaceAfter=0),
    'tdb':     P('tdb', fontName='Helvetica-Bold', fontSize=8.8, leading=12, textColor=DARK, spaceAfter=0),
    'note':    P('note', fontSize=9.2, leading=13.4, textColor=DARK, spaceAfter=0),
    'quote':   P('quote', fontName='Helvetica-Oblique', fontSize=9.2, leading=13.4, textColor=MUTED, spaceAfter=0),
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


def table(header, rows, widths, colorise=False):
    data = [[Paragraph(c, S['th']) for c in header]]
    for r in rows:
        cells = [Paragraph(r[0], S['tdb'])]
        for c in r[1:]:
            st = S['td']
            if colorise:
                if c == 'Yes':
                    st = P('y', fontName='Helvetica-Bold', fontSize=8.8, leading=12,
                           textColor=GREEN, spaceAfter=0)
                elif c == 'No':
                    st = P('n', fontSize=8.8, leading=12, textColor=colors.HexColor('#b9c2d0'),
                           spaceAfter=0)
                elif c == '&mdash;':
                    st = P('d', fontSize=8.8, leading=12, textColor=colors.HexColor('#ccd3de'),
                           spaceAfter=0)
                else:
                    st = P('o', fontSize=8.8, leading=12, textColor=AMBER, spaceAfter=0)
            cells.append(Paragraph(c, st))
        data.append(cells)
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
A(Spacer(1, 20 * mm))
A(Paragraph('Second Skool', S['title']))
A(Paragraph('The complete feature guide &mdash; what the head teacher, the teacher '
            'and the student each get', S['sub']))
E(figure(role_trio(CW),
         'One app, three roles. Every screen below belongs to one of these columns.'))
E(callout('Who this is for',
          'Every screen in Second Skool is shared by three kinds of people. This guide walks '
          'through all of them in order, so a new head teacher can set a centre up, a new '
          'teacher knows exactly what they can and cannot touch, and anyone answering a '
          'parent&rsquo;s question knows what the child is actually looking at.'))
E(callout('One idea holds the whole product together',
          'A parent should be able to see everything without asking anyone, the child should '
          'not be able to hide any of it, and the teacher should never be the one blamed for '
          'a missed message. Every feature below exists to serve that.', GREEN))
A(Spacer(1, 6))
A(Paragraph('Second Skool is a single installable web app. There is nothing to download from '
            'a store, it works on any phone or laptop, and it remembers when it last synced '
            'so nobody is reading stale numbers without knowing it.', S['small']))
A(PageBreak())

# ------------------------------------------------------------- contents ----
E(h1('What is in this guide'))
E(table(['Part', 'Covers'],
        [['1. Getting in', 'Creating a centre, joining as a teacher, registering a student, approvals'],
         ['2. The head teacher', 'Everything a teacher can do, plus the ten things only a head can'],
         ['3. The teacher', 'The daily loop: attendance, results, homework, study material, reminders'],
         ['4. The student and parent', 'The twelve screens a child and their parent can open'],
         ['5. Shared across every role', 'Notifications, theme, installing the app, working without a '
                                        'signal, reporting a problem'],
         ['6. Quick reference', 'The full head-versus-teacher permission table']],
        [45 * mm, 125 * mm]))

E(h1('Part 1 &mdash; Getting in', 'Three doors, deliberately different. Staff sign in properly. '
                                  'Students never do.'))

A(Paragraph('The opening screen', S['h2']))
A(Paragraph('Whoever opens the app for the first time sees three choices: <b>Teacher &mdash; '
            'continue with Google</b>, <b>Teacher &mdash; sign in with password</b>, and '
            '<b>I&rsquo;m a student</b>. Underneath sits the sentence that explains the whole '
            'model: <i>&ldquo;Your tuition centre sets up teacher access. Students only ever '
            'need their code.&rdquo;</i>', S['body']))

A(Paragraph('How a member of staff gets in', S['h2']))
E(figure(flow(CW, [
    ('Sign in', 'Google, or email and password once one is set'),
    ('Profile', 'Name, phone, subject, qualification - all four required'),
    ('Choose', 'Create a centre, or join one with its code'),
    ('Wait', 'A joiner sees nothing until the head approves them'),
    ('Work', 'Tabs and data appear the moment approval lands'),
], BLUE, 52),
  'The staff route. A head skips step four - creating a centre approves you into it.'))

E(bullets([
    '<b>Create a centre</b> &mdash; they become the head teacher, and the centre is theirs. '
    'They pick the centre name, and can add a logo later.',
    '<b>Join a centre</b> &mdash; they enter the centre join code their head teacher gave them, '
    'and then wait. Nothing is visible to them until the head approves them.',
]))
A(Paragraph('A teacher who has requested access sees a waiting screen with a <b>Check again</b> '
            'button, and nothing else &mdash; no navigation bar, no data. If the head rejects '
            'them, they see a plain &ldquo;Access not granted&rdquo; instead. Both screens carry '
            'a WhatsApp link, because someone who cannot get in also cannot file a support '
            'report from inside the app.', S['body']))

A(Paragraph('How a student gets in', S['h2']))
E(figure(flow(CW, [
    ('Get a code', 'Staff add them, or they register with the centre code'),
    ('Approval', 'A teacher sets their batch, fee and due date'),
    ('Code works', 'Only after approval does the code let them in'),
    ('Allow alerts', 'Mandatory - a test alert fires straight away'),
], GREEN, 52),
  'The student route. No email, no password, and no way in until a human says yes.'))

E(callout('The code is the account',
          'A student has no email and no password. The code is typed once and remembered on that '
          'device. It is also printed permanently on the student&rsquo;s own profile page with a '
          'copy button, because before that it only ever appeared in a message that vanished, and '
          'anyone who did not write it down was locked out of a new phone.'))

A(Paragraph('Approving people', S['h2']))
A(Paragraph('Staff requests and student requests are two separate queues, and only the head sees '
            'the staff one.', S['body']))
E(table(['Queue', 'Who reviews it', 'What the reviewer sees and decides'],
        [['Staff access &amp; approvals', 'Head only',
          'Name, email, phone as a tappable call link, the subject they teach and their '
          'qualification. Approve or Reject. Existing staff can be promoted to head or removed.'],
         ['Student requests', 'Head or teacher',
          'The details the student typed. The reviewer sets their batch, an optional monthly fee '
          'and a due date, then confirms. Only then does their code start working.']],
        [43 * mm, 27 * mm, 100 * mm]))
A(Paragraph('The staff approvals screen refreshes itself live, so a head watching it sees a new '
            'request appear without reloading. Both screens show the relevant join code in a '
            'dashed box that copies when tapped.', S['body']))
A(PageBreak())

# ------------------------------------------------------------------ head ---
E(h1('Part 2 &mdash; The head teacher',
     'A head can do everything a teacher can do, and ten things a teacher cannot.'))

E(figure(phone_row(CW, [
    ('Home', STAFF_TABS_HEAD, SC.head_home, 'Head teacher. Five tabs.'),
    ('Home', STAFF_TABS_TEA, SC.teacher_home, 'Teacher. Four tabs, same parent reach card.'),
]), 'The same home screen for both staff roles. The only difference here is the Staff tab.'))

A(Paragraph('The home screen', S['h2']))
A(Paragraph('A head opens onto the centre logo and name, a branch pill they can tap to jump '
            'straight to branch management, a notification bell that shows a red dot when '
            'something needs them, and two tiles &mdash; classes scheduled today, and total '
            'students. Below that sit four quick actions: <b>Attendance</b>, <b>Results</b>, '
            '<b>Assignment</b> and <b>Reminder</b>. Then today&rsquo;s schedule, in order.',
            S['body']))

A(Paragraph('Parent reach', S['h3']))
A(Paragraph('<b>Parent reach &middot; this week</b> answers a question no attendance register '
            'can: how many families actually opened the app. It reads &ldquo;34 of 48&rdquo; with '
            'a progress bar, and a line underneath saying how many did not open it this week. '
            'Tapping it opens the student list already filtered to exactly those families. '
            'Both staff roles see the card, because a parent who never opens the app is a parent '
            'who never sees the absence, and it is the teacher who gets asked about that at the '
            'end of term. What the head has and the teacher does not is the chase itself: a '
            'WhatsApp button beside each name on that filtered list, which sends the family '
            'their child&rsquo;s link code.', S['body']))
E(callout('Why that card exists',
          'A centre can be recording everything perfectly and still have half its parents unaware '
          'of any of it. Reach is the number that says whether the work is landing.', GREEN))

A(Paragraph('Staff', S['h2']))
A(Paragraph('The head gets a fifth tab that teachers do not: <b>Staff</b>. It is a searchable '
            'list of everyone teaching at the centre, showing each person&rsquo;s subject, years '
            'of experience and qualification, with an <b>+ Add</b> button for entering a teacher '
            'directly. Teachers can see the same roster read-only from elsewhere, but cannot add '
            'to it.', S['body']))
A(PageBreak())

A(Paragraph('Management', S['h2']))
A(Paragraph('Under <b>More</b>, a head sees a whole second block of items that is simply absent '
            'for a teacher.', S['body']))

E(figure(phone_row(CW, [
    ('More', STAFF_TABS_HEAD, SC.head_more, 'Head. Daily work, then the management block.'),
    ('More', STAFF_TABS_TEA, SC.teacher_more, 'Teacher. The daily work, and then the list ends.'),
]), 'The More tab is where the two roles diverge most. Everything in the dashed box on the left '
    'is head-only.'))

E(table(['Management item', 'What it does'],
        [['Staff access &amp; approvals',
          'Approve or reject teachers, promote someone to head, remove someone. Shows the centre '
          'join code. Carries a badge with the number waiting.'],
         ['Weekly report',
          'A 7-day or 30-day report in three tabs. See below.'],
         ['Fees &amp; alerts',
          'Money collected and money outstanding, adding a single fee or a whole installment plan, '
          'and a one-tap alert to every family with a payment due.'],
         ['Rankings',
          'Subject-by-subject ranked lists of every student, generated from published results. '
          'Nothing to maintain &mdash; they update themselves.'],
         ['Meetings',
          'Schedule a parent-teacher meeting or a staff meeting, and invite everyone. Only a head '
          'can cancel one.'],
         ['Branches',
          'Add branches with an address, mark one as the main branch, see each branch&rsquo;s '
          'student roster and staff count.'],
         ['Subjects',
          'Add or remove the subjects the centre teaches. Removing one warns that its tests, '
          'results and timetable periods go with it.'],
         ['Batches',
          'Add or remove batch labels. Removing a batch keeps every record &mdash; only the label '
          'goes.']],
        [42 * mm, 128 * mm]))

A(Paragraph('The weekly report in detail', S['h3']))
A(Paragraph('The report screen has a 7-day / 30-day toggle and three tabs.', S['body']))
E(bullets([
    '<b>Branches</b> &mdash; per branch: student count with new joiners, staff count, attendance '
    'percentage, fees collected and fees pending.',
    '<b>Students</b> &mdash; per student: attendance percentage, number of tests with their '
    'average, and their fee status. Each row has a green <b>Send to parent</b> button that opens '
    'WhatsApp with the child&rsquo;s summary already written. If the centre has no number for '
    'that parent, the button says so instead of failing.',
    '<b>Teachers</b> &mdash; per staff member: how many attendance sessions, results and '
    'assignments they recorded in the period. The screen states plainly that activity is only '
    'counted from when that person started using the app.',
]))

A(Paragraph('Fees, one at a time or a year at a time', S['h3']))
A(Paragraph('The fee form has two modes. <b>One fee</b> takes an amount, a period and a due date. '
            '<b>Installment plan</b> takes the total for the year, any discount, how many '
            'installments, the first due date and how often they repeat &mdash; monthly, every two '
            'months, quarterly or half-yearly &mdash; and writes all of them at once. Before Save '
            'is pressed, the form already says how many installments there will be, the months they '
            'run from and to, and the exact rupees of the first one and of every one after it. '
            'Uneven division rides on the <i>first</i> installment, never the last: a final payment '
            'two rupees short reads to a parent as a bug, while a first payment two rupees heavy '
            'reads as the plan.', S['body']))
E(bullets([
    'Both fee screens carry a summary line &mdash; total, how many of how many are paid, what is '
    'still outstanding, and the amount and date of the next one due.',
    '<b>Overdue</b> is worked out from the due date each time the screen is read, so a fee is '
    'marked overdue the morning it becomes true, without anything having to run overnight.',
    'Removing a plan takes off only the unpaid installments. Anything already marked paid stays, '
    'because that money was collected and erasing it would take it out of the fees report too.',
]))

A(Paragraph('The other head-only powers', S['h2']))
E(bullets([
    '<b>Editing the timetable.</b> Only a head can add, edit or delete a period. Teachers open '
    'the same screen and read it.',
    '<b>Rotating the student join code.</b> Behind a confirmation that says the current code stops '
    'working immediately.',
    '<b>Cancelling a meeting.</b> Behind a confirmation that reminds the head parents are not '
    'automatically told.',
    '<b>Fee amounts on the student list.</b> A head sees a fee pill on each student row and can '
    'open the full record. A teacher sees the roster without it.',
    '<b>Renaming the centre and setting its logo.</b> From My Profile. The logo is what students '
    'see when they log in with that centre&rsquo;s code.',
]))
A(PageBreak())

# --------------------------------------------------------------- teacher ---
E(h1('Part 3 &mdash; The teacher',
     'Five jobs, one loop, and nothing to configure. A teacher never has to set the app up.'))

E(figure(flow(CW, [
    ('Attendance', 'Tap a name to toggle present or absent'),
    ('Results', 'Marks are checked before anything saves'),
    ('Homework', 'Title, due date, and the class is notified'),
    ('Material', 'A note, a PDF or a video link'),
    ('Reminders', 'Five templates, three audiences'),
], INDIGO, 50),
  'The whole teacher product. Each one is a screen under More, and each one notifies the '
  'families it concerns.'))

A(Paragraph('Mark attendance', S['h2']))
A(Paragraph('Pick a class from the chips along the top. Two tiles count present and absent as '
            'you go. Tap a student to toggle them between present and absent, then save. '
            'Switching class loads that class&rsquo;s own register, so nothing carries over.',
            S['body']))
A(Paragraph('The screen opens on what is already recorded for today &mdash; not on a blank sheet. '
            'A teacher who marked four children absent, walked away and came back sees those four '
            'still marked. Anything the register holds that this screen cannot produce, such as a '
            'leave, shows as present rather than being guessed at as an absence.', S['body']))
E(callout('A small thing that matters',
          'Marks are held against the student, not against their position in the list. If the '
          'roster reorders while the sheet is open &mdash; someone is added, someone is approved '
          '&mdash; an absent mark cannot slide onto the wrong child.'))

A(Paragraph('Marking a register with no signal', S['h3']))
A(Paragraph('Attendance is the one thing in the app that still works with the internet gone. '
            'Normally Save sends the register straight to the centre. With no signal there is '
            'nowhere to send it, so the app keeps the register <b>on the phone</b> instead, and '
            'says so: <i>&ldquo;Saved on this phone. They will sync by themselves once you are '
            'back online.&rdquo;</i> An amber bar along the top counts how many marks are still '
            'waiting, so nothing sits there unsent without her knowing.', S['body']))
A(Paragraph('The moment the phone has a signal again the waiting marks go up on their own. There '
            'is nothing to press and nothing to remember. Three rules make that safe:', S['body']))
E(bullets([
    '<b>The date is fixed when she marks, not when it sends.</b> A Tuesday register that syncs on '
    'Wednesday morning is still Tuesday&rsquo;s. Filing it under Wednesday would mark a class that '
    'never met and leave Tuesday blank.',
    '<b>Waiting marks are shown on the register.</b> Open attendance again and she sees her own '
    'work, not an empty sheet &mdash; otherwise she would mark the whole class a second time.',
    '<b>A waiting mark is only written where the centre has nothing.</b> It can never overwrite '
    'anybody. Why that is the right rule is below.',
]))
E(callout('What happens if two people marked the same class',
          'Her marks were made offline, so none of them ever reached the centre. Anything the '
          'centre does have for that child that day was therefore put in by somebody who was '
          'online, after she lost signal &mdash; their mark is the fresh one and hers is the old '
          'one. So where the centre already has an answer, hers is not applied. If it says the '
          'same thing, nothing happens and nothing is reported: two people marking the same child '
          'absent is not a disagreement. If it says something different, she gets a card naming '
          'the child, the day, what she put and what the centre has, and she decides. That costs '
          'her one tap. Overwriting would cost a child a wrong absence and their parent an alert '
          'about it, which is the one message a centre cannot take back.', AMBER))
E(bullets([
    'Waiting marks survive closing the app, and survive restarting the phone.',
    'Absence alerts to parents go out only for the marks that actually saved &mdash; never for one '
    'the centre&rsquo;s register turned down.',
    'The bar counts marks, not registers. &ldquo;84 marks waiting&rdquo; is the size of what she '
    'would lose; &ldquo;3 registers waiting&rdquo; tells her nothing.',
]))

A(Paragraph('Enter results', S['h2']))
A(Paragraph('Choose the class, the subject, a test name and the maximum mark, then type each '
            'student&rsquo;s score. Every mark is checked before anything is written: it must be '
            'a whole number between zero and the maximum. If the publish fails halfway, the app '
            'removes the half-created test and says clearly that nothing was saved rather than '
            'leaving an empty test behind. On success, the whole class is notified that new '
            'results are published, and rankings update on their own.', S['body']))

A(Paragraph('Assignments', S['h2']))
A(Paragraph('A title, subject, class, due date and instructions, then <b>Create &amp; notify '
            'class</b>. Active assignments are listed underneath and can be deleted '
            'individually. The student sees the title and due date immediately, and can tap it '
            'open to read the instructions.', S['body']))

A(Paragraph('Study material', S['h2']))
A(Paragraph('Share a note with a class: a title, a subject, and free text. Optionally attach a '
            'PDF or an image up to 10&nbsp;MB, and optionally paste a video link &mdash; YouTube '
            'or Drive. Students get a <i>new material</i> badge that clears the moment they open '
            'the screen.', S['body']))

A(Paragraph('Send reminders', S['h2']))
A(Paragraph('Five kinds of reminder, each with wording already written: <b>Notice</b>, '
            '<b>Fees</b>, <b>Homework</b>, <b>Test</b> and <b>Absence</b>. Choose who receives '
            'it &mdash; all students, only today&rsquo;s absentees, or only students with fees '
            'due &mdash; edit the message if you want to, and send. Everything sent recently is '
            'listed underneath so nobody sends the same reminder twice.', S['body']))

A(Paragraph('Student requests', S['h2']))
A(Paragraph('A teacher can approve students, not staff. The item sits at the top of the '
            '<b>More</b> list with a badge when somebody is waiting, and the <b>More</b> tab '
            'itself carries a red dot so a waiting child is never missed.', S['body']))

A(Paragraph('What a teacher deliberately cannot do', S['h2']))
E(table(['Screen', 'What is different for a teacher'],
        [['Students', 'Read-only. No <b>+ Add</b>, no fee amounts, rows do not open, and no '
                      'WhatsApp chase button.'],
         ['Timetable', 'Read-only. No add, edit or delete.'],
         ['Staff', 'The tab does not exist. Teachers see the roster only through the read-only '
                   'view students also get.'],
         ['Meetings', 'Can see them, cannot cancel one.'],
         ['Management block', 'Absent entirely: fees, reports, rankings, branches, subjects, '
                              'batches, staff approvals and the join code.'],
         ['Home', 'The parent reach card is there, and taps through to the families who did '
                  'not open the app. The WhatsApp chase button on that list is not.']],
        [36 * mm, 134 * mm]))
E(callout('This is a design rule, not an oversight',
          'A feature that costs a teacher extra typing every day does not ship, because adoption '
          'is the bottleneck. Everything above is either something a teacher already does on '
          'paper, or something the app works out for itself.', AMBER))
A(PageBreak())

# --------------------------------------------------------------- student ---
E(h1('Part 4 &mdash; The student and parent',
     'Twelve screens, all read-only. Nothing here can be edited by the child.'))

E(figure(phone_row(CW, [
    ('Home', STU_TABS, SC.stu_home, 'Home. Attendance, rank, and a way into everything else.'),
    ('Attendance', STU_TABS, SC.stu_attendance, 'Attendance. The overall ring, then every day.'),
    ('Results', STU_TABS, SC.stu_results, 'Results. A grade per test and an average across all.'),
]), 'Three of the five student tabs. Nothing on any of them can be changed by the child.'))

A(Paragraph('The five tabs', S['h2']))
A(Paragraph('A signed-in student gets <b>Home</b>, <b>Results</b>, <b>Ranking</b>, '
            '<b>Teachers</b> and <b>Profile</b> along the bottom. Everything else opens from '
            'the home screen.', S['body']))

E(table(['Screen', 'What it shows'],
        [['Home',
          'The centre logo and name, the branch, an attendance tile, a rank tile, the day&rsquo;s '
          'classes, and shortcuts into everything below. A bell shows a dot when there is '
          'something new.'],
         ['Attendance',
          'A large ring with the overall present percentage, a line reading how many class days '
          'were attended out of how many, and how many absences and leaves there were recently. '
          'Then a day-by-day log.'],
         ['Test Results',
          'An overall grade and average across every test, then each test with its subject, '
          'name, date, marks out of the maximum, a grade badge and a bar.'],
         ['Ranking',
          'Subject-by-subject standings with the top three highlighted. The child is matched by '
          'their own record, never by name.'],
         ['Teachers',
          'The faculty at their branch. If the timetable says who takes their classes, those '
          'teachers are listed first under <b>Your teachers</b> with the subjects they take that '
          'child.'],
         ['Teacher profile',
          'One teacher: subject, years of experience, qualification, rating, and an about note '
          'if they wrote one.'],
         ['My Timetable',
          'A day picker across the week, then that day&rsquo;s periods with times, subject and '
          'room. Free periods are shown greyed rather than hidden.'],
         ['Homework',
          'Every assignment with its subject and due date. Tap one to expand the full '
          'instructions.'],
         ['Study Material',
          'Notes the teachers shared, with a file to open or a video link to follow.'],
         ['Fees',
          'A red card with the amount due, the period and the due date &mdash; always the '
          '<i>soonest</i> unpaid one, which is the whole point once a family is on an installment '
          'plan &mdash; or a green &ldquo;All clear!&rdquo; when there is nothing outstanding. Then '
          'the payment history, with a line saying how many installments of how many are paid.'],
         ['Notifications',
          'Everything the centre has sent: results, homework, fees, notices, absence alerts.'],
         ['My Profile',
          'Their name, grade and average, their student code with a copy button, and their '
          'school, standard, parent contact and address &mdash; each with a padlock.']],
        [36 * mm, 134 * mm]))
A(PageBreak())

E(figure(phone_row(CW, [
    ('Fees', STU_TABS, SC.stu_fees, 'Fees. What is owed, what was paid, and when.'),
    ('', None, SC.lockscreen, 'The phone itself. Every one of these is sent automatically.'),
], pw=126), 'Left: the fees screen. Right: what actually reaches the family, without anyone '
            'having to open the app first.'))

A(Paragraph('Nothing on this side is editable', S['h2']))
A(Paragraph('Every detail on the student profile is centre-managed. The screen says so directly: '
            '<i>&ldquo;Your details are managed by your tuition centre and can&rsquo;t be changed '
            'here. Ask your teacher if something needs updating.&rdquo;</i> A child cannot change '
            'the parent&rsquo;s phone number, and so cannot quietly cut the parent out.', S['body']))

A(Paragraph('Notifications are not optional for students', S['h2']))
A(Paragraph('Before a student reaches any screen, they must allow notifications. If they decline, '
            'the app shows them exactly where the setting is on their phone and states the '
            'consequence: <i>&ldquo;You will not be told about tests, homework or fees until you '
            'allow them.&rdquo;</i> Once permission is granted, a test alert fires immediately, '
            'so the family can see with their own eyes that the phone really will show one.',
            S['body']))
E(callout('This is the strictest rule in the product',
          'A silent app is the same as no app. A parent who was never notified cannot act, and '
          'the teacher gets blamed for it. So the gate is absolute: students must have reminders '
          'on, full stop.', RED))

A(Paragraph('Honest empty states', S['h2']))
A(Paragraph('When there is genuinely no data, the app says so rather than showing a zero. A '
            'student never marked shows a dash on the attendance tile, not 0%. An empty homework '
            'list reads &ldquo;No homework assigned yet. New assignments from your teacher will '
            'appear here.&rdquo; A parent should never mistake &ldquo;nothing recorded&rdquo; for '
            '&ldquo;nothing achieved&rdquo;.', S['body']))
A(PageBreak())

# ---------------------------------------------------------------- shared ---
E(h1('Part 5 &mdash; Shared across every role'))

A(Paragraph('Notifications on this device', S['h2']))
A(Paragraph('Every role can turn on push notifications from their own profile or notifications '
            'screen. Enabling it fires a test alert straight away, so nobody has to wonder '
            'whether it worked.', S['body']))

A(Paragraph('Light and dark', S['h2']))
A(Paragraph('A theme toggle sits in the header of both home screens. Every colour in the app is '
            'defined once for light and once for dark, so both themes are complete &mdash; there '
            'is no screen that only works in one of them.', S['body']))

A(Paragraph('Installing it', S['h2']))
A(Paragraph('Second Skool is a progressive web app, so it can be added to a phone&rsquo;s home '
            'screen and opened like any other app. Staff who install it can set an email and '
            'password from <b>My Profile</b>, which keeps them signed in on the installed app '
            'without the Google redirect.', S['body']))

A(Paragraph('Knowing the data is fresh', S['h2']))
A(Paragraph('Both home screens carry a last-updated line, and the data refreshes itself after '
            'every change and whenever the app comes back to the foreground.', S['body']))

A(Paragraph('When the signal drops', S['h2']))
A(Paragraph('A bar appears along the top of the app and tells the truth about which of three '
            'states it is in.', S['body']))
E(table(['The bar says', 'What it means'],
        [['No internet &mdash; only attendance can be saved right now',
          'The phone is offline. Nothing else will write, and the app says so up front rather than '
          'letting somebody fill a form that is going to fail.'],
         ['<i>N</i> attendance marks saved on this phone, syncing&hellip;',
          'The signal is back and the registers marked without it are on their way. The count is '
          'marks, not registers, because that is the size of what is still unsent.'],
         ['Back online',
          'Everything synced. The bar goes away by itself.']],
        [72 * mm, 98 * mm]))

A(Paragraph('When a centre outgrows one page of data', S['h2']))
A(Paragraph('The app loads each table up to a fixed number of rows, newest first, so a very large '
            'centre would lose its oldest tail &mdash; and a fees total short by whatever fell off '
            'the end is a wrong number nobody can see is wrong. If a centre ever reaches one of '
            'those caps, the app now says which table it was and asks for a report, instead of '
            'quietly serving a smaller number than the truth.', S['body']))

A(Paragraph('Report a problem', S['h2']))
A(Paragraph('Every role &mdash; head, teacher and student &mdash; has a <b>Report a problem</b> '
            'row: on <b>More</b> for staff, on <b>My Profile</b> for students. It asks four short '
            'questions rather than offering a blank box.', S['body']))
E(figure(flow(CW, [
    ('The question', 'What were you trying to do?'),
    ('The problem', 'What happened instead?'),
    ('The place', 'Which part of the app?'),
    ('How often', 'Does it happen every time?'),
], AMBER, 44), 'Plus an optional screenshot. Replies come back inside the app, with a red '
                'badge when an answer is waiting.'))

A(Paragraph('Errors that stay long enough to read', S['h2']))
A(Paragraph('Success messages disappear after a couple of seconds. Error messages hold for nine, '
            'are announced to screen readers, and can be dismissed by tapping. An error nobody '
            'read is an error that happens again.', S['body']))
A(PageBreak())

E(h1('Part 6 &mdash; Quick reference', 'The complete split, in one table.'))
E([legend(CW, [(GREEN, 'Full access'), (AMBER, 'Partial or view-only'),
               (colors.HexColor('#b9c2d0'), 'Not available')]), Spacer(1, 8)])

E(table(['Capability', 'Head', 'Teacher', 'Student'],
        [['Mark attendance', 'Yes', 'Yes', 'View own'],
         ['Mark attendance with no signal', 'Yes', 'Yes', '&mdash;'],
         ['Enter and publish results', 'Yes', 'Yes', 'View own'],
         ['Create assignments', 'Yes', 'Yes', 'View'],
         ['Share study material', 'Yes', 'Yes', 'View'],
         ['Send reminders', 'Yes', 'Yes', 'Receives'],
         ['Approve student requests', 'Yes', 'Yes', '&mdash;'],
         ['View the student roster', 'Full', 'Read-only, no fees', 'Own record only'],
         ['Add or edit a student', 'Yes', 'No', 'No'],
         ['View the timetable', 'Yes', 'Yes', 'Yes'],
         ['Edit the timetable', 'Yes', 'No', 'No'],
         ['Staff tab and roster', 'Yes', 'Read-only view', 'Read-only view'],
         ['Add a teacher', 'Yes', 'No', 'No'],
         ['Approve or remove staff', 'Yes', 'No', 'No'],
         ['Promote someone to head', 'Yes', 'No', 'No'],
         ['Fees and payment alerts', 'Yes', 'No', 'Own fees only'],
         ['Create an installment plan', 'Yes', 'No', 'Sees own installments'],
         ['Weekly and monthly reports', 'Yes', 'No', 'No'],
         ['Send a report to a parent', 'Yes', 'No', '&mdash;'],
         ['Rankings', 'Yes', 'No', 'Own subject ranks'],
         ['Schedule a meeting', 'Yes', 'Yes', 'Notified'],
         ['Cancel a meeting', 'Yes', 'No', 'No'],
         ['Branches', 'Yes', 'No', 'Sees own branch'],
         ['Subjects and batches', 'Yes', 'No', 'No'],
         ['Rotate the student join code', 'Yes', 'No', 'No'],
         ['Rename the centre, set the logo', 'Yes', 'No', 'Sees the logo'],
         ['Parent reach card', 'Yes', 'Yes', '&mdash;'],
         ['WhatsApp a family who did not open the app', 'Yes', 'No', '&mdash;'],
         ['Report a problem', 'Yes', 'Yes', 'Yes']],
        [70 * mm, 27 * mm, 38 * mm, 35 * mm], colorise=True))

A(Spacer(1, 6))
A(Paragraph('Every statement in this guide was taken from the running application, and the '
            'screens drawn throughout it follow the app&rsquo;s own layout and palette. Where '
            'the app and this document ever disagree, the app is right and this page needs '
            'updating.', S['small']))


def footer(canv, doc):
    canv.saveState()
    canv.setFont('Helvetica', 7.6)
    canv.setFillColor(MUTED)
    canv.drawString(20 * mm, 12 * mm, 'Second Skool  |  Complete Feature Guide')
    canv.drawRightString(190 * mm, 12 * mm, str(doc.page))
    canv.setStrokeColor(LINE)
    canv.setLineWidth(0.4)
    canv.line(20 * mm, 15.5 * mm, 190 * mm, 15.5 * mm)
    canv.restoreState()


doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=20 * mm, rightMargin=20 * mm,
                        topMargin=18 * mm, bottomMargin=20 * mm,
                        title='Second Skool - Complete Feature Guide',
                        author='Second Skool')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print('written', OUT, os.path.getsize(OUT), 'bytes')

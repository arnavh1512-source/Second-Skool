import { describe, it, expect } from 'vitest'
import { parseRoster, normalizePhone, normalizeClass, MAX_IMPORT } from '../app/lib/roster-import'

describe('normalizePhone', () => {
  it('accepts the forms a phone book actually holds', () => {
    for (const raw of ['9876543210', '98765 43210', '+91 98765-43210', '919876543210', '+91-9876543210'])
      expect(normalizePhone(raw)).toBe('+919876543210')
  })

  it('rejects anything that is not an Indian mobile', () => {
    // A wrong number here sends a child's attendance to a stranger, so the
    // truncated paste and the stray year have to fail.
    for (const raw of ['', '5876543210', '987654321', '98765432101', '2026', 'not a number'])
      expect(normalizePhone(raw)).toBeNull()
  })

  it('rejects a landline, and the trunk-zero mobile it cannot be told apart from', () => {
    // '079 2630 1234' is Ahmedabad; drop the zero and it reads as a mobile
    // starting 79. There is no shape that separates the two, so both are
    // refused rather than one of them guessed at.
    expect(normalizePhone('079 2630 1234')).toBeNull()
    expect(normalizePhone('09876543210')).toBeNull()
  })
})

describe('normalizeClass', () => {
  it('lands the five spellings of one class on the same string', () => {
    for (const raw of ['10', '10th', 'Class 10', 'class10', 'STD 10', 'Standard 10', 'Grade 10', 'X', 'x'])
      expect(normalizeClass(raw)).toBe('Class 10')
  })

  it('rejects what is not a standard', () => {
    for (const raw of ['0', '13', 'Rahul', '', 'Class A', '2026'])
      expect(normalizeClass(raw)).toBeNull()
  })

  it('does not resolve inherited object properties as roman numerals', () => {
    // An unguarded lookup into an object literal finds Object.prototype.
    for (const raw of ['constructor', 'toString', 'valueOf'])
      expect(normalizeClass(raw)).toBeNull()
  })
})

describe('parseRoster', () => {
  const none: { name: string; parent?: string }[] = []

  it('reads a tab-separated paste out of a spreadsheet, header and all', () => {
    const raw = [
      'Name\tClass\tParent\tSchool',
      'Rahul Sharma\t10\t9876543210\tSt Xavier',
      'Priya Patel\t9\t9123456780\tDPS',
    ].join('\n')
    const { students, skipped } = parseRoster(raw, none, 'Class 10')
    expect(skipped).toEqual([])
    expect(students).toEqual([
      { name: 'Rahul Sharma', klass: 'Class 10', parent: '+919876543210', school: 'St Xavier' },
      { name: 'Priya Patel', klass: 'Class 9', parent: '+919123456780', school: 'DPS' },
    ])
  })

  it('reads a numbered list off WhatsApp', () => {
    const raw = '1. Rahul Sharma - 98765 43210\n2) Priya Patel - 91234 56780'
    const { students } = parseRoster(raw, none, 'Class 8')
    expect(students.map(s => s.name)).toEqual(['Rahul Sharma', 'Priya Patel'])
    expect(students.map(s => s.parent)).toEqual(['+919876543210', '+919123456780'])
    // Neither line said a class, so both take the one she picked on the screen.
    expect(students.every(s => s.klass === 'Class 8')).toBe(true)
  })

  it('reads the cells by what they hold, not by which column they sit in', () => {
    // The same three students, in three different column orders. Asking her to
    // rearrange the list first would cost more than the typing did.
    const orders = [
      'Rahul Sharma, 10, 9876543210',
      '9876543210, Rahul Sharma, Class 10',
      'Class 10 | 9876543210 | Rahul Sharma',
    ]
    for (const raw of orders)
      expect(parseRoster(raw, none, 'Class 5').students[0])
        .toEqual({ name: 'Rahul Sharma', klass: 'Class 10', parent: '+919876543210', school: '' })
  })

  it('keeps the space inside a name and still splits on a run of them', () => {
    const { students } = parseRoster('Rahul Kumar Sharma    Class 10', none, 'Class 1')
    expect(students[0]).toMatchObject({ name: 'Rahul Kumar Sharma', klass: 'Class 10' })
  })

  it('imports a student with no number rather than dropping them', () => {
    // The thinnest rows are usually the ones added to the list in a hurry.
    // Skipping them would quietly lose exactly those students.
    const { students, skipped } = parseRoster('Rahul Sharma', none, 'Class 10')
    expect(skipped).toEqual([])
    expect(students[0]).toEqual({ name: 'Rahul Sharma', klass: 'Class 10', parent: '', school: '' })
  })

  it('skips a line with nothing that could be a name', () => {
    const { students, skipped } = parseRoster('9876543210, Class 10\nRahul Sharma', none, 'Class 10')
    expect(students).toHaveLength(1)
    expect(skipped).toEqual([{ line: 1, text: '9876543210, Class 10', reason: 'no name on this line' }])
  })

  it('reports the line number of the raw paste, blanks included', () => {
    // She is looking at the box she pasted into; a number that counts only the
    // lines we liked points at the wrong row.
    const { skipped } = parseRoster('Rahul Sharma\n\n\n9876543210', none, 'Class 10')
    expect(skipped[0].line).toBe(4)
  })

  it('refuses the same student twice in one paste', () => {
    // Same child, typed by two people. Only the case differs — a run of spaces
    // would have been read as a column break, which the splitting test covers.
    const { students, skipped } = parseRoster('Rahul Sharma, 9876543210\nRAHUL SHARMA, 9123456780', none, 'Class 10')
    expect(students).toHaveLength(1)
    expect(skipped[0].reason).toBe('the same student twice in this list')
  })

  it('catches a repeat by number even when the name is spelled differently', () => {
    const { students, skipped } = parseRoster('Rahul Sharma, 9876543210\nR Sharma, 98765 43210', none, 'Class 10')
    expect(students).toHaveLength(1)
    expect(skipped[0].reason).toBe('the same student twice in this list')
  })

  it('refuses someone already on the roster, by name or by number', () => {
    const existing = [{ name: 'Rahul Sharma', parent: '+919876543210' }]
    const { students, skipped } = parseRoster('rahul sharma, 9000000001\nSomeone Else, 9876543210\nPriya Patel, 9123456780', existing, 'Class 10')
    // A re-import hands the parent a second login code for one child, with no
    // way to tell which one the teacher is looking at.
    expect(students.map(s => s.name)).toEqual(['Priya Patel'])
    expect(skipped.map(s => s.reason)).toEqual(['already on your roster', 'already on your roster'])
  })

  it('ignores blank lines and a trailing newline', () => {
    expect(parseRoster('\n\nRahul Sharma\n\n', none, 'Class 10').students).toHaveLength(1)
  })

  it('reads nothing out of an empty paste', () => {
    expect(parseRoster('   \n\n', none, 'Class 10')).toEqual({ students: [], skipped: [], overflow: 0 })
  })

  it('stops at the cap and says how many it did not look at', () => {
    const raw = Array.from({ length: MAX_IMPORT + 7 }, (_, i) => `Student ${i}, 9${String(100000000 + i)}`).join('\n')
    const { students, overflow } = parseRoster(raw, none, 'Class 10')
    expect(students).toHaveLength(MAX_IMPORT)
    expect(overflow).toBe(7)
  })

  it('drops a header row only when every cell is a column name', () => {
    // "Name" alone on a line is a header; a student genuinely called Name is
    // not a case worth losing sixty rows of trust over. But a row that merely
    // starts with a field word is a student.
    expect(parseRoster('Name\tClass\nRahul Sharma\t10', none, 'Class 10').students).toHaveLength(1)
    expect(parseRoster('Contact Kumar\t10\t9876543210', none, 'Class 10').students[0].name).toBe('Contact Kumar')
  })
})

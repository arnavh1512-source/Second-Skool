// Copy shown in the UI. Data, not logic — kept out of the slices so a wording
// change never touches a file that talks to the database.

export const REMINDER_TEMPLATES: Record<string, string> = {
  Notice: 'Dear parents, please note the following update from the centre: ',
  Fee: 'Gentle reminder: the tuition fee is due. Please clear it at the earliest.',
  Homework: 'Reminder: Please submit the pending homework before the next class.',
  Test: 'Reminder: a unit test is scheduled for tomorrow. Please ensure your child revises the relevant chapters.',
  Absence: 'Your child was marked absent today. Kindly inform us of the reason or share any concerns.',
}

import type { CSSProperties, ReactNode } from 'react'

// The app's icon set. Hand-drawn on a 24×24 grid at a single stroke weight so
// every glyph reads as one family, and painted in `currentColor` so an icon
// picks up whatever td-* token its container already sets — no per-icon colour
// prop, and no icon library dependency.
//
// Emoji were what these used to be. They render differently on every platform
// (Windows vs Android vs iOS), they can't inherit colour, and they sit on the
// text baseline rather than the icon grid, which is why they never lined up
// with the hand-written SVGs already in Shell.tsx and HomeScreen.tsx.

export type IconName =
  | 'home' | 'timetable' | 'meetings' | 'students' | 'staff'
  | 'attendance' | 'results' | 'homework' | 'notes' | 'reminder'
  | 'approvals' | 'requests' | 'reports' | 'fees' | 'rankings'
  | 'branches' | 'subjects' | 'batches'
  | 'absent' | 'leave'
  | 'notice' | 'test' | 'absence'
  | 'standard' | 'school' | 'phone' | 'address' | 'star'
  | 'gold' | 'silver' | 'bronze'
  | 'warning' | 'console' | 'next'

// A medal disc with the rank struck through the middle. The three ranks share
// one drawing and differ only by numeral, so they stay a set at any size.
const medal = (rank: 1 | 2 | 3): ReactNode => (
  <>
    <circle cx="12" cy="14.9" r="6.3" />
    <path d="M8.6 9.6 6 3.6h3.9l1.9 3.7" />
    <path d="M15.4 9.6 18 3.6h-3.9l-1.9 3.7" />
    <text
      x="12" y="18.4" textAnchor="middle" fontSize="9.5" fontWeight="800"
      fill="currentColor" stroke="none" fontFamily="inherit"
    >{rank}</text>
  </>
)

const PATHS: Record<IconName, ReactNode> = {
  home: <>
    <path d="M3.2 10.6 12 3.4l8.8 7.2" />
    <path d="M5.6 9.3V20.6h12.8V9.3" />
    <path d="M9.8 20.6v-5.2h4.4v5.2" />
  </>,
  timetable: <>
    <rect x="3.2" y="5" width="17.6" height="15.8" rx="3" />
    <path d="M3.2 10h17.6M8 3.2v3.6M16 3.2v3.6" />
    <path d="M7.6 13.6h2M11 13.6h2M14.4 13.6h2M7.6 17h2M11 17h2" />
  </>,
  meetings: <>
    <rect x="3.2" y="5" width="17.6" height="15.8" rx="3" />
    <path d="M3.2 10h17.6M8 3.2v3.6M16 3.2v3.6" />
    <path d="M8.8 15.2 11 17.4l4.3-4.3" />
  </>,
  students: <>
    <circle cx="9.2" cy="8" r="3.4" />
    <path d="M3 20.6c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6" />
    <path d="M16.2 5.2a3.4 3.4 0 0 1 0 6.4" />
    <path d="M17 14.9c2.4.6 4 2.6 4 5.1" />
  </>,
  staff: <>
    <rect x="3.2" y="3.2" width="17.6" height="10.6" rx="2.4" />
    <path d="M7 6.9h7.4M7 10.1h4.4" />
    <circle cx="12" cy="17.6" r="2.2" />
    <path d="M8.2 22c.4-1.7 1.9-2.9 3.8-2.9s3.4 1.2 3.8 2.9" />
  </>,
  attendance: <>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M8 12.2 10.7 15l5.5-5.6" />
  </>,
  results: <>
    <path d="M4 20.4h16" />
    <path d="M7.5 20.4v-5.8M12 20.4V9.6M16.5 20.4v-3.6" />
  </>,
  homework: <>
    <rect x="3.4" y="4.6" width="4.2" height="15" rx="1.2" />
    <rect x="9" y="4.6" width="4.2" height="15" rx="1.2" />
    <path d="m15.6 6.4 3.5 1-2.9 12.4-3.5-1" />
  </>,
  notes: <>
    <path d="M6.2 3.4h7.4L19 8.8v11.8H6.2z" strokeLinejoin="round" />
    <path d="M13.4 3.4v5.4H19" />
    <path d="M9.2 13.4h6M9.2 16.8h4" />
  </>,
  reminder: <>
    <path d="M6.6 16.2v-5.6a5.4 5.4 0 1 1 10.8 0v5.6l1.8 2.4H4.8z" strokeLinejoin="round" />
    <path d="M9.9 20.6a2.2 2.2 0 0 0 4.2 0" />
  </>,
  approvals: <>
    <path d="M12 3.2 19 6v5.6c0 4.3-2.9 7.6-7 9.5-4.1-1.9-7-5.2-7-9.5V6z" strokeLinejoin="round" />
    <path d="m9.1 12 2.2 2.2 3.9-4" />
  </>,
  requests: <>
    <circle cx="9.6" cy="8.2" r="3.4" />
    <path d="M3.6 20.6c0-3.3 2.7-5.4 6-5.4s6 2.1 6 5.4" />
    <path d="M19 5.2v5M16.5 7.7h5" />
  </>,
  reports: <>
    <path d="M3.4 20.6h17.2" />
    <path d="m4.6 15.4 4.6-5 3.5 3.5 6.2-6.6" />
    <path d="M15.2 7.3h4v4" />
  </>,
  fees: <>
    <rect x="2.6" y="5.2" width="18.8" height="13.6" rx="3" />
    <path d="M2.6 10h18.8" />
    <path d="M6.4 14.8h3.4" />
  </>,
  rankings: <>
    <path d="M8 3.6h8v5.2a4 4 0 0 1-8 0z" strokeLinejoin="round" />
    <path d="M8 5.4H5.4a2.6 2.6 0 0 0 2.8 4.9" />
    <path d="M16 5.4h2.6a2.6 2.6 0 0 1-2.8 4.9" />
    <path d="M12 12.9v3.6" />
    <path d="M8.4 20.4h7.2" />
  </>,
  branches: <>
    <rect x="3.6" y="3.2" width="10.4" height="17.6" rx="2.2" />
    <path d="M6.7 7h1.4M10 7h1.4M6.7 10.6h1.4M10 10.6h1.4M6.7 14.2h1.4M10 14.2h1.4" />
    <path d="M14 9.4h4.2a2 2 0 0 1 2 2v9.4H14" />
    <path d="M16.6 13.6h1.2M16.6 17h1.2" />
  </>,
  subjects: <>
    <path d="M12 7.6c-1.6-1.5-3.8-2.3-6.5-2.3H3.6v12.2h2c2.7 0 4.9.8 6.4 2.3" />
    <path d="M12 7.6c1.6-1.5 3.8-2.3 6.5-2.3h1.9v12.2h-2c-2.7 0-4.9.8-6.4 2.3" />
    <path d="M12 7.6v12.2" />
  </>,
  batches: <>
    <rect x="3.4" y="3.4" width="7.2" height="7.2" rx="2.2" />
    <rect x="13.4" y="3.4" width="7.2" height="7.2" rx="2.2" />
    <rect x="3.4" y="13.4" width="7.2" height="7.2" rx="2.2" />
    <rect x="13.4" y="13.4" width="7.2" height="7.2" rx="2.2" />
  </>,
  absent: <>
    <circle cx="12" cy="12" r="8.8" />
    <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
  </>,
  leave: <>
    <rect x="5" y="4.2" width="14" height="16.6" rx="2.6" />
    <rect x="8.9" y="2.2" width="6.2" height="4" rx="1.6" />
    <path d="M9 12.2h6M9 16h4" />
  </>,
  notice: <>
    <path d="M4 10.6v2.8A1.6 1.6 0 0 0 5.6 15h2.6l7.4 4.4V4.6L8.2 9H5.6A1.6 1.6 0 0 0 4 10.6z" strokeLinejoin="round" />
    <path d="M18.4 9.4a3.6 3.6 0 0 1 0 5.2" />
    <path d="M8.6 15.4V20" />
  </>,
  test: <>
    <path d="m4 20.4 1.1-4.1L15.5 5.8a2.1 2.1 0 0 1 3 3L8.1 19.3z" strokeLinejoin="round" />
    <path d="m13.6 7.7 3 3" />
  </>,
  absence: <>
    <circle cx="9.6" cy="8.2" r="3.4" />
    <path d="M3.6 20.6c0-3.3 2.7-5.4 6-5.4 1 0 1.9.2 2.7.5" />
    <path d="m15.8 16 4.6 4.6M20.4 16l-4.6 4.6" />
  </>,
  standard: <>
    <path d="M2.6 9.4 12 5.4l9.4 4-9.4 4z" strokeLinejoin="round" />
    <path d="M6.4 11.4v4.4c0 1.4 2.5 2.5 5.6 2.5s5.6-1.1 5.6-2.5v-4.4" />
    <path d="M21.4 9.4v4.6" />
  </>,
  school: <>
    <path d="M12 3 20.4 7.2v2H3.6v-2z" strokeLinejoin="round" />
    <path d="M5.4 9.2v11.4h13.2V9.2" />
    <path d="M10 20.6v-4.6h4v4.6" />
    <path d="M8.2 12.4h1.4M14.4 12.4h1.4" />
  </>,
  phone: <>
    <rect x="6.4" y="2.6" width="11.2" height="18.8" rx="3" />
    <path d="M10.4 18.6h3.2" />
  </>,
  address: <>
    <path d="M12 21.2s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" strokeLinejoin="round" />
    <circle cx="12" cy="10" r="2.6" />
  </>,
  star: <path d="m12 3.6 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 10l6-.9z" strokeLinejoin="round" />,
  gold: medal(1),
  silver: medal(2),
  bronze: medal(3),
  warning: <>
    <path d="M12 4.2 21.2 20H2.8z" strokeLinejoin="round" />
    <path d="M12 10.2v4.2" />
    <circle cx="12" cy="17.3" r=".9" fill="currentColor" stroke="none" />
  </>,
  console: <>
    <path d="M4 8h9.4M18.2 8h1.8" />
    <circle cx="15.8" cy="8" r="2.2" />
    <path d="M4 16h3.6M12 16h8" />
    <circle cx="9.8" cy="16" r="2.2" />
  </>,
  next: <path d="m9.6 5.6 6.6 6.4-6.6 6.4" />,
}

// notifications.icon is a persisted column: every row written before this icon
// set landed still holds the emoji the app used at the time, and those rows come
// back from get_student_snapshot for as long as the student keeps them. Map the
// old values forward on read so a student's history renders in the new set
// rather than as a lone emoji among SVGs.
const LEGACY_EMOJI: Record<string, IconName> = {
  '🏠': 'home', '📅': 'timetable', '🗓️': 'timetable', '📆': 'meetings',
  '👥': 'students', '🧑‍🏫': 'staff', '✅': 'attendance', '📊': 'results',
  '📚': 'homework', '📄': 'notes', '🔔': 'reminder', '🛡️': 'approvals',
  '🙋': 'requests', '📈': 'reports', '💳': 'fees', '🏆': 'rankings',
  '🏢': 'branches', '📖': 'subjects', '❌': 'absent', '📋': 'leave',
  '📢': 'notice', '📝': 'test', '🟡': 'absence', '🏫': 'school',
  '📱': 'phone', '📍': 'address', '⭐': 'star', '🥇': 'gold',
  '🥈': 'silver', '🥉': 'bronze', '⚠️': 'warning', '🛠️': 'console',
  '▶': 'next',
}

// Accepts either an IconName or a legacy emoji from the database. Returns null
// for anything unrecognised so callers can decide on a fallback rather than
// rendering a blank square.
export function toIconName(value: string | null | undefined): IconName | null {
  if (!value) return null
  if (value in PATHS) return value as IconName
  return LEGACY_EMOJI[value] ?? null
}

// The five pastel tints the app uses behind an icon tile. An emoji carried its
// own colour; a stroked icon inherits one, so each tint needs a matching ink or
// every tile would come out the same slate grey. Kept here so the pairing is
// defined once instead of at each of the tiles.
const TINT_INK: Record<string, string> = {
  '#e7f5ee': '#2fa36b', // green
  '#eaf1fc': '#2a6fdb', // primary blue
  '#fcf3e3': '#e0962f', // amber
  '#fdecea': '#e8553c', // red
  '#eef0fc': '#5a63c9', // indigo
}

export const ink = (tint: string) => TINT_INK[tint] ?? '#2a6fdb'

type IconProps = {
  name: IconName
  size?: number
  className?: string
  style?: CSSProperties
  strokeWidth?: number
}

export function Icon({ name, size = 22, className, style, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round"
      className={className} style={style} aria-hidden="true" focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}

// For values that come out of the database rather than out of the code. Falls
// back to `fallback` when the stored string matches nothing we can draw.
export function DataIcon({
  value, fallback = 'notice', ...rest
}: Omit<IconProps, 'name'> & { value: string | null | undefined; fallback?: IconName }) {
  return <Icon name={toIconName(value) ?? fallback} {...rest} />
}

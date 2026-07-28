// Regenerates Second-Skool-Source-Code.md — the full source dump handed to the
// external reviewer. Run after any code change:  node scripts/gen-source-dump.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { globSync } from 'node:fs'

const root = process.cwd()
const sh = c => execSync(c, { cwd: root }).toString().trim()

// Ordered sections mirror the reviewer-facing layout: docs first, then the app
// source, root config, static assets, database SQL, and tests.
const order = [
  '.claude/launch.json', '.gitignore', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'SETUP.md',
  ...glob('app/**/*.{ts,tsx,css}'),
  'eslint.config.mjs', 'next.config.ts', 'package.json', 'postcss.config.mjs',
  'public/manifest.json', 'public/sw.js',
  ...glob('supabase/**/*.sql'),
  ...glob('tests/**/*.{ts,tsx}'),
  'tsconfig.json', 'vitest.config.ts',
]

function glob(pattern) {
  return globSync(pattern, { cwd: root }).map(p => p.replaceAll('\\', '/')).sort()
}

const lang = path => {
  const ext = path.split('.').pop()
  return { ts: 'ts', tsx: 'ts', css: 'css', md: 'md', mjs: 'js', json: 'json', sql: 'sql', gitignore: 'gitignore' }[
    path.endsWith('.gitignore') ? 'gitignore' : ext
  ] ?? 'text'
}

const hash = sh('git rev-parse --short HEAD')
const subject = sh('git log -1 --pretty=%s')
const date = new Date().toISOString().slice(0, 10)

let out = `# Second Skool — Full Source Code\n\nGenerated ${date} · commit \`${hash}\` · ${subject}\n\n`
const missing = []
for (const rel of order) {
  if (!existsSync(rel)) { missing.push(rel); continue }
  const body = readFileSync(rel, 'utf8').replace(/\s+$/, '')
  out += `\n## ${rel}\n\n\`\`\`${lang(rel)}\n${body}\n\`\`\`\n`
}

writeFileSync('Second-Skool-Source-Code.md', out)
const files = order.length - missing.length
console.log(`Wrote Second-Skool-Source-Code.md — ${files} files, ${out.split('\n').length} lines`)
if (missing.length) console.log('Skipped (not found): ' + missing.join(', '))

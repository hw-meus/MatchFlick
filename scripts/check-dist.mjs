// Søger i den byggede frontend (dist) efter hemmelige nøgler.
// Køres automatisk i GitHub Actions før hver deploy og kan køres lokalt med
// `npm run check-dist` efter `npm run build`. Afslutter med fejl, hvis noget findes.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
if (!existsSync(DIST)) {
  console.error('Mappen dist findes ikke. Kør `npm run build` først.')
  process.exit(1)
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* files(path)
    else yield path
  }
}

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1]
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

// Kendte hemmeligheder fra miljøet, som aldrig må optræde ordret i dist.
const exactSecrets = ['TMDB_API_KEY', 'TMDB_READ_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ACCESS_TOKEN']
  .map((name) => [name, process.env[name]])
  .filter(([, value]) => value && value.length >= 8)

const problems = []

for (const path of files(DIST)) {
  const text = readFileSync(path, 'utf8')

  if (/service_role/.test(text)) problems.push(`${path}: indeholder teksten "service_role"`)
  if (/sb_secret_[A-Za-z0-9_-]+/.test(text)) problems.push(`${path}: indeholder en hemmelig Supabase-nøgle (sb_secret_)`)

  // TMDB's v3-nøgle er 32 hextegn.
  for (const m of text.matchAll(/(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])/g)) {
    problems.push(`${path}: ligner en TMDB API-nøgle (${m[0].slice(0, 4)}…)`)
  }

  // Alle JWT'er i frontend skal være Supabases anon-nøgle.
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    const payload = decodeJwtPayload(m[0])
    if (!payload || payload.role !== 'anon') {
      problems.push(`${path}: indeholder en JWT, som ikke er en anon-nøgle (fx TMDB-token eller service_role)`)
    }
  }

  for (const [name, value] of exactSecrets) {
    if (text.includes(value)) problems.push(`${path}: indeholder værdien af ${name}`)
  }
}

if (problems.length) {
  console.error('Hemmelige nøgler fundet i dist:\n' + problems.map((p) => '  - ' + p).join('\n'))
  process.exit(1)
}
console.log('Ingen hemmelige nøgler fundet i dist.')

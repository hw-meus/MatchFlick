import type { SeasonsSeen } from './types'

// Fx [1,2,3,5] → "1–3 og 5".
function ranges(seasons: number[]): string {
  const sorted = [...new Set(seasons)].sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i]
    while (sorted[i + 1] === sorted[i] + 1) i++
    parts.push(start === sorted[i] ? String(start) : `${start}–${sorted[i]}`)
  }
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} og ${parts[parts.length - 1]}` : parts[0] ?? ''
}

// Tekst til visning, fx "Alle sæsoner", "Sæson 1–3" eller "Ikke angivet".
export function seasonsLabel(s: SeasonsSeen | null): string {
  if (!s) return 'Sæsoner ikke angivet'
  if (s.all) return 'Alle sæsoner'
  if (!s.seen.length) return 'Sæsoner ikke angivet'
  return `Sæson ${ranges(s.seen)}`
}

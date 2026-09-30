import type { SeasonsSeen, SeenSwipe } from './types'

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

export function seasonsOf(s: SeenSwipe | undefined): SeasonsSeen | null {
  if (!s) return null
  return s.seasons_seen?.length || s.all_seasons ? { seen: s.seasons_seen ?? [], all: s.all_seasons } : null
}

// Den højeste sæson, personen har set (0, hvis ingen er angivet).
function reached(s: SeasonsSeen | null): number {
  return s?.seen.length ? Math.max(...s.seen) : 0
}

function plural(n: number): string {
  return n === 1 ? '1 sæson' : `${n} sæsoner`
}

export interface SeasonComparison {
  text: string
  // Sat, når I er lige langt, og der findes en næste sæson, I kan se sammen.
  readyForSeason: number | null
}

// Sammenligner, hvor langt de to er nået i en serie, og beskriver det i almindeligt sprog.
// `total` er antallet af sæsoner ifølge TMDB lige nu.
export function compareSeasons(
  mine: SeenSwipe | undefined,
  partner: SeenSwipe | undefined,
  total: number | null,
  partnerName: string,
): SeasonComparison {
  const my = seasonsOf(mine)
  const their = seasonsOf(partner)
  const none = { readyForSeason: null }

  if (!mine) {
    return { text: their ? `${partnerName} har set ${seasonsLabel(their).toLowerCase()}. Du er ikke begyndt.` : `${partnerName} har set serien. Du er ikke begyndt.`, ...none }
  }
  if (!partner) {
    return { text: my ? `Du har set ${seasonsLabel(my).toLowerCase()}. ${partnerName} er ikke begyndt.` : `Du har set serien. ${partnerName} er ikke begyndt.`, ...none }
  }
  if (!my && !their) return { text: 'Ingen af jer har angivet sæsoner endnu.', ...none }
  if (!their) return { text: `${partnerName} har ikke angivet sæsoner endnu.`, ...none }
  if (!my) return { text: 'Du har ikke angivet sæsoner endnu.', ...none }

  const a = reached(my)
  const b = reached(their)
  if (a === b) {
    if (!total) return { text: `I er lige langt: I har begge set til og med sæson ${a}.`, ...none }
    if (a < total) {
      const next = a + 1
      // Begge havde set alle sæsoner, men TMDB kender nu flere: en ny sæson er kommet.
      const text = my.all && their.all
        ? `Ny sæson ${next} er kommet. Klar til at se den sammen.`
        : `I er lige langt. Klar til sæson ${next} sammen.`
      return { text, readyForSeason: next }
    }
    return { text: 'I har begge set alle sæsoner.', ...none }
  }
  const detail = `(du: ${ranges(my.seen)}, ${partnerName}: ${ranges(their.seen)})`
  return a > b
    ? { text: `Du er ${plural(a - b)} foran ${detail}.`, ...none }
    : { text: `${partnerName} er ${plural(b - a)} foran ${detail}.`, ...none }
}

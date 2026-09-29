import type { MediaType, TitleMetadata } from './types'

const IMAGE_BASE = 'https://image.tmdb.org/t/p/'

export function imageUrl(path: string | null, size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780'): string | null {
  return path ? IMAGE_BASE + size + path : null
}

export function trailerUrl(key: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(key)}`
}

export function typeLabel(type: MediaType): string {
  return type === 'movie' ? 'Film' : 'Serie'
}

// Fx "2 t 15 min" for film og "3 sæsoner" for serier.
export function lengthLabel(m: TitleMetadata): string | null {
  if (m.media_type === 'tv') {
    if (!m.seasons) return null
    return m.seasons === 1 ? '1 sæson' : `${m.seasons} sæsoner`
  }
  if (!m.runtime) return null
  const h = Math.floor(m.runtime / 60)
  const min = m.runtime % 60
  return h ? `${h} t${min ? ` ${min} min` : ''}` : `${min} min`
}

import { useEffect } from 'react'
import type { Title } from '../lib/types'
import { lengthLabel, trailerUrl, typeLabel } from '../lib/tmdb'
import { OriginalTitle, Providers } from './SwipeCard'

// Viser hele resuméet i et vindue nedefra. Kortet bagved står stille, mens man læser.
export function DetailsSheet({ title, onClose }: { title: Title; onClose: () => void }) {
  const m = title.metadata

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={m.title} onClick={(e) => e.stopPropagation()}>
        <h2>
          {m.title} {m.year && <span className="muted">({m.year})</span>}
        </h2>
        <OriginalTitle metadata={m} />
        <p className="meta">
          {[typeLabel(m.media_type), lengthLabel(m), m.genres.join(', ')].filter(Boolean).join(' · ')}
        </p>
        <p>{m.overview}</p>
        <Providers providers={m.providers} />
        <div className="row">
          {m.trailer ? (
            <a href={trailerUrl(m.trailer)} target="_blank" rel="noreferrer">▶ Se trailer</a>
          ) : (
            <span />
          )}
          <button className="primary" onClick={onClose}>Luk</button>
        </div>
      </div>
    </div>
  )
}

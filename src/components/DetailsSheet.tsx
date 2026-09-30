import { useEffect } from 'react'
import type { Title } from '../lib/types'
import { lengthLabel, trailerUrl, typeLabel } from '../lib/tmdb'
import { OriginalTitle, Providers } from './SwipeCard'

// Viser hele resuméet i et vindue. Siden bagved låses, så det kun er vinduet, der ruller.
export function DetailsSheet({ title, onClose }: { title: Title; onClose: () => void }) {
  const m = title.metadata

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const html = document.documentElement
    const previous = [html.style.overflow, document.body.style.overflow]
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      ;[html.style.overflow, document.body.style.overflow] = previous
    }
  }, [onClose])

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={m.title}>
        <div className="sheet-head">
          <div>
            <h2>
              {m.title} {m.year && <span className="muted">({m.year})</span>}
            </h2>
            <OriginalTitle metadata={m} />
          </div>
          <button className="close" onClick={onClose} aria-label="Luk">✕</button>
        </div>
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
    </>
  )
}

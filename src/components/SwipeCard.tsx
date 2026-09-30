import { useRef, useState, type PointerEvent } from 'react'
import type { Title } from '../lib/types'
import { imageUrl, lengthLabel, trailerUrl, typeLabel } from '../lib/tmdb'

export type Gesture = 'like' | 'nope' | 'seen' | 'superlike'

const THRESHOLD = 100
const DOUBLE_TAP_MS = 300

interface Props {
  title: Title
  // Sættes af knapperne, så kortet flyver ud i samme retning som ved et swipe.
  leaving: Gesture | null
  onGesture: (g: Gesture) => void
  // Åbner hele resuméet i et vindue, hvor det kan rulles, uden at kortet flytter sig.
  onDetails: () => void
}

function direction(dx: number, dy: number): Gesture | null {
  if (-dy > THRESHOLD && -dy > Math.abs(dx)) return 'seen'
  if (dx > THRESHOLD) return 'like'
  if (dx < -THRESHOLD) return 'nope'
  return null
}

const LABELS: Record<Gesture, string> = {
  like: 'Vil gerne',
  nope: 'Nej tak',
  seen: 'Har set den',
  superlike: 'Superlike',
}

export function SwipeCard({ title, leaving, onGesture, onDetails }: Props) {
  const m = title.metadata
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const lastTap = useRef(0)

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (leaving || (e.target as HTMLElement).closest('a, button')) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ x: 0, y: 0 })
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!start.current || start.current.id !== e.pointerId) return
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y })
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!start.current || start.current.id !== e.pointerId) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    start.current = null
    setDrag(null)

    const g = direction(dx, dy)
    if (g) return onGesture(g)

    // Et tryk uden bevægelse: to tryk hurtigt efter hinanden er en superlike.
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const now = Date.now()
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0
        onGesture('superlike')
      } else {
        lastTap.current = now
      }
    }
  }

  function onPointerCancel() {
    start.current = null
    setDrag(null)
  }

  const hint = drag ? direction(drag.x, drag.y) : leaving
  let transform = ''
  if (leaving === 'like' || leaving === 'superlike') transform = 'translate(150%, -5%) rotate(20deg)'
  else if (leaving === 'nope') transform = 'translate(-150%, -5%) rotate(-20deg)'
  else if (leaving === 'seen') transform = 'translate(0, -150%)'
  else if (drag) transform = `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 20}deg)`

  const poster = imageUrl(m.poster, 'w500')
  const length = lengthLabel(m)

  return (
    <div
      className={`swipe-card${drag ? ' dragging' : ''}${leaving ? ' leaving' : ''}`}
      style={{ transform }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="poster">
        {poster ? <img src={poster} alt="" draggable={false} /> : <div className="poster-missing">{m.title}</div>}
        {hint && <div className={`stamp stamp-${hint}`}>{LABELS[hint]}</div>}
        {m.trailer && (
          <a className="trailer" href={trailerUrl(m.trailer)} target="_blank" rel="noreferrer">
            ▶ Trailer
          </a>
        )}
      </div>
      <div className="info">
        <h2>
          {m.title} {m.year && <span className="muted">({m.year})</span>}
        </h2>
        <OriginalTitle metadata={m} />
        <p className="meta">
          {[typeLabel(m.media_type), length, m.genres.slice(0, 3).join(', ')].filter(Boolean).join(' · ')}
        </p>
        {m.overview && (
          <>
            <p className="overview">{m.overview}</p>
            <button type="button" className="link read-more" onClick={onDetails}>Læs mere</button>
          </>
        )}
        <Providers providers={m.providers} />
      </div>
    </div>
  )
}

// Den danske titel kan være svær at genkende (fx "I lovens navn" for "Law & Order"), så vis også originalen.
export function OriginalTitle({ metadata: m }: { metadata: Title['metadata'] }) {
  if (!m.original_title || m.original_title.toLowerCase() === m.title.toLowerCase()) return null
  return <p className="original-title">{m.original_title}</p>
}

export function Providers({ providers }: { providers: Title['metadata']['providers'] }) {
  if (!providers.length) return <p className="providers muted">Ikke på en streamingtjeneste i Danmark lige nu.</p>
  return (
    <ul className="providers" aria-label="Kan ses på">
      {providers.map((p) => {
        const logo = imageUrl(p.logo, 'w92')
        return (
          <li key={p.id} title={p.name}>
            {logo ? <img src={logo} alt={p.name} /> : p.name}
          </li>
        )
      })}
    </ul>
  )
}

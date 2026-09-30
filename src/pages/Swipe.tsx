import { useCallback, useEffect, useRef, useState } from 'react'
import { SwipeCard, type Gesture } from '../components/SwipeCard'
import { RatingDialog } from '../components/RatingDialog'
import { DetailsSheet } from '../components/DetailsSheet'
import { fetchQueue, saveSwipe, snooze } from '../lib/api'
import { danishError } from '../lib/errors'
import { imageUrl } from '../lib/tmdb'
import type { Title } from '../lib/types'

type Choice = Gesture | 'snooze'

// Hentes en ny portion, når der er så få kort tilbage.
const REFILL_AT = 5
const LEAVE_MS = 250

export function Swipe({ userId }: { userId: string }) {
  const [queue, setQueue] = useState<Title[]>([])
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<Gesture | null>(null)
  const [rating, setRating] = useState<Title | null>(null)
  const [details, setDetails] = useState<Title | null>(null)
  const fetching = useRef(false)
  // Alle titler, der er vist i denne session, så de ikke kommer igen, før swipet er gemt.
  const seen = useRef(new Set<string>())

  const refill = useCallback(async () => {
    if (fetching.current) return
    fetching.current = true
    setError(null)
    try {
      const { titles, partnerLiked } = await fetchQueue([...seen.current])
      const fresh = titles.filter((t) => !seen.current.has(t.id))
      fresh.forEach((t) => seen.current.add(t.id))
      // Titler, partneren har liket, lægges lige efter det kort, der vises nu, så de ikke
      // skal vente bag resten af køen. Den øvrige portion lægges bagerst.
      const liked = new Set(partnerLiked)
      const soon = fresh.filter((t) => liked.has(t.id))
      const later = fresh.filter((t) => !liked.has(t.id))
      setQueue((q) => (q.length ? [q[0], ...soon, ...q.slice(1), ...later] : [...soon, ...later]))
      setEmpty(fresh.length === 0)
    } catch (e) {
      setError(danishError(e))
    } finally {
      fetching.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refill()
  }, [refill])

  useEffect(() => {
    if (!loading && !empty && queue.length > 0 && queue.length <= REFILL_AT) refill()
  }, [queue.length, loading, empty, refill])

  const current = queue[0]

  const record = useCallback(
    async (title: Title, choice: Choice, stars: number | null = null) => {
      try {
        if (choice === 'snooze') await snooze(userId, title.id)
        else await saveSwipe(userId, title.id, choice, stars)
      } catch (e) {
        setError(`Dit valg blev ikke gemt: ${danishError(e)}`)
      }
    },
    [userId],
  )

  const next = useCallback(
    (choice: Choice) => {
      if (!current || leaving) return
      if (choice === 'seen') {
        setRating(current)
        return
      }
      const title = current
      setLeaving(choice === 'snooze' ? 'seen' : choice)
      record(title, choice)
      setTimeout(() => {
        setQueue((q) => q.slice(1))
        setLeaving(null)
      }, LEAVE_MS)
    },
    [current, leaving, record],
  )

  function finishSeen(stars: number | null) {
    const title = rating!
    setRating(null)
    setLeaving('seen')
    record(title, 'seen', stars)
    setTimeout(() => {
      setQueue((q) => q.slice(1))
      setLeaving(null)
    }, LEAVE_MS)
  }

  // Piletaster på computer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (rating || details || (e.target as HTMLElement).closest('input, textarea, select')) return
      const map: Record<string, Choice> = { ArrowRight: 'like', ArrowLeft: 'nope', ArrowUp: 'seen', ArrowDown: 'snooze', s: 'superlike' }
      const choice = map[e.key]
      if (choice) {
        e.preventDefault()
        next(choice)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, rating, details])

  return (
    <div className="swipe">
      <div className="deck">
        {queue[1] && (
          <div className="swipe-card behind" aria-hidden="true">
            <SwipeCardPlaceholder title={queue[1]} />
          </div>
        )}
        {current ? (
          <SwipeCard key={current.id} title={current} leaving={leaving} onGesture={next} onDetails={() => setDetails(current)} />
        ) : (
          <div className="deck-empty">
            {loading ? (
              <p>Henter titler …</p>
            ) : empty ? (
              <p>Der er ikke flere titler lige nu. Prøv at slå filteret for streamingtjenester fra under Indstillinger.</p>
            ) : error ? null : (
              <p>Henter flere titler …</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="error">
          {error}{' '}
          <button className="link" onClick={refill}>Prøv igen</button>
        </p>
      )}

      <div className="actions" aria-label="Handlinger">
        <button className="act nope" onClick={() => next('nope')} disabled={!current} aria-label="Nej tak">
          ✕<span>Nej tak</span>
        </button>
        <button className="act snooze" onClick={() => next('snooze')} disabled={!current} aria-label="Ikke nu">
          ⏸<span>Ikke nu</span>
        </button>
        <button className="act seen" onClick={() => next('seen')} disabled={!current} aria-label="Har set den">
          👁<span>Har set</span>
        </button>
        <button className="act superlike" onClick={() => next('superlike')} disabled={!current} aria-label="Superlike">
          ★<span>Superlike</span>
        </button>
        <button className="act like" onClick={() => next('like')} disabled={!current} aria-label="Vil gerne se">
          ♥<span>Vil gerne</span>
        </button>
      </div>
      <p className="hint center">Swipe til højre for "vil gerne", til venstre for "nej tak" og op for "har set den". Tryk to gange for superlike.</p>

      {details && <DetailsSheet title={details} onClose={() => setDetails(null)} />}

      {rating && (
        <RatingDialog heading={`Du har set ${rating.metadata.title}`} onDone={finishSeen} onCancel={() => setRating(null)} />
      )}
    </div>
  )
}

// Kortet bagved vises kun som plakat, så det ikke kan betjenes.
function SwipeCardPlaceholder({ title }: { title: Title }) {
  const poster = imageUrl(title.metadata.poster, 'w500')
  return <div className="poster">{poster && <img src={poster} alt="" draggable={false} />}</div>
}

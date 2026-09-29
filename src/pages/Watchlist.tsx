import { useEffect, useMemo, useState } from 'react'
import { Providers } from '../components/SwipeCard'
import { Stars } from '../components/RatingDialog'
import { loadMatches, rateMatch, setMatchStatus } from '../lib/api'
import { danishError } from '../lib/errors'
import { imageUrl, lengthLabel, trailerUrl, typeLabel } from '../lib/tmdb'
import type { Couple, Match } from '../lib/types'

type Sort = 'newest' | 'oldest' | 'rating'

interface Props {
  userId: string
  couple: Couple
  // Øges, når Realtime melder et nyt eller ændret match, så listen genindlæses.
  version: number
}

export function Watchlist({ userId, couple, version }: Props) {
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState('')
  const [genre, setGenre] = useState('')
  const [provider, setProvider] = useState('')
  const [status, setStatus] = useState('unseen')
  const [sort, setSort] = useState<Sort>('newest')

  useEffect(() => {
    let cancelled = false
    loadMatches()
      .then((m) => !cancelled && setMatches(m))
      .catch((e) => !cancelled && setError(danishError(e)))
    return () => {
      cancelled = true
    }
  }, [version])

  const genres = useMemo(
    () => [...new Set((matches ?? []).flatMap((m) => m.titles.metadata.genres))].sort((a, b) => a.localeCompare(b, 'da')),
    [matches],
  )
  const providers = useMemo(() => {
    const byId = new Map<number, string>()
    for (const m of matches ?? []) for (const p of m.titles.metadata.providers) byId.set(p.id, p.name)
    return [...byId].sort((a, b) => a[1].localeCompare(b[1], 'da'))
  }, [matches])

  const shown = useMemo(() => {
    const list = (matches ?? []).filter((m) => {
      const md = m.titles.metadata
      return (
        (!type || md.media_type === type) &&
        (!genre || md.genres.includes(genre)) &&
        (!provider || md.providers.some((p) => String(p.id) === provider)) &&
        (!status || m.status === status)
      )
    })
    const byDate = (a: Match, b: Match) => Date.parse(b.created_at) - Date.parse(a.created_at)
    if (sort === 'oldest') list.sort((a, b) => -byDate(a, b))
    else if (sort === 'rating') list.sort((a, b) => (b.titles.metadata.vote_average ?? 0) - (a.titles.metadata.vote_average ?? 0))
    else list.sort(byDate)
    return list
  }, [matches, type, genre, provider, status, sort])

  function patch(id: string, change: Partial<Match>) {
    setMatches((list) => list?.map((m) => (m.id === id ? { ...m, ...change } : m)) ?? null)
  }

  async function toggleSeen(m: Match) {
    const next = m.status === 'seen' ? 'unseen' : 'seen'
    patch(m.id, { status: next })
    try {
      await setMatchStatus(m.id, next)
    } catch (e) {
      patch(m.id, { status: m.status })
      setError(danishError(e))
    }
  }

  async function rate(m: Match, rating: number) {
    patch(m.id, { status: 'seen', ratings: { ...m.ratings, [userId]: rating } })
    try {
      await rateMatch(m.id, rating)
    } catch (e) {
      patch(m.id, { status: m.status, ratings: m.ratings })
      setError(danishError(e))
    }
  }

  const partner = couple.members.find((p) => p.id !== userId)

  if (error && !matches) return <p className="error">{error}</p>
  if (!matches) return <p className="muted">Henter watch list …</p>

  return (
    <div className="watchlist">
      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="unseen">Ikke set</option>
          <option value="seen">Set</option>
          <option value="">Alle</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">Film og serier</option>
          <option value="movie">Film</option>
          <option value="tv">Serier</option>
        </select>
        <select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre">
          <option value="">Alle genrer</option>
          {genres.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Streamingtjeneste">
          <option value="">Alle tjenester</option>
          {providers.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sortering">
          <option value="newest">Nyeste først</option>
          <option value="oldest">Ældste først</option>
          <option value="rating">Bedst bedømt på TMDB</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      {matches.length === 0 ? (
        <section className="card">
          <h2>Ingen matches endnu</h2>
          <p>Når I begge har swipet til højre på den samme titel, dukker den op her.</p>
        </section>
      ) : shown.length === 0 ? (
        <p className="muted">Ingen matches passer til filteret.</p>
      ) : (
        <ul className="match-list">
          {shown.map((m) => {
            const md = m.titles.metadata
            const poster = imageUrl(md.poster, 'w185')
            const partnerRating = partner ? m.ratings[partner.id] ?? null : null
            return (
              <li key={m.id} className={`match${m.status === 'seen' ? ' seen' : ''}`}>
                {poster ? <img className="thumb" src={poster} alt="" /> : <div className="thumb" />}
                <div className="match-body">
                  <h3>
                    {md.title} {md.year && <span className="muted">({md.year})</span>}
                  </h3>
                  <p className="meta">
                    {[typeLabel(md.media_type), lengthLabel(md), md.genres.slice(0, 3).join(', ')].filter(Boolean).join(' · ')}
                  </p>
                  <Providers providers={md.providers} />
                  <div className="row wrap">
                    <label className="check">
                      <input type="checkbox" checked={m.status === 'seen'} onChange={() => toggleSeen(m)} />
                      Set
                    </label>
                    {md.trailer && (
                      <a href={trailerUrl(md.trailer)} target="_blank" rel="noreferrer">▶ Trailer</a>
                    )}
                  </div>
                  {m.status === 'seen' && (
                    <div className="ratings">
                      <div>
                        <span className="muted">Din vurdering</span>
                        <Stars small value={m.ratings[userId] ?? null} onChange={(v) => rate(m, v)} />
                      </div>
                      {partner && (
                        <div>
                          <span className="muted">{partner.display_name || 'Partner'}</span>
                          <Stars small value={partnerRating} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="hint">Sortering efter forventet fælles glæde kommer, når appen begynder at lære jeres smag.</p>
    </div>
  )
}

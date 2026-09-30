import { useState, type FormEvent } from 'react'
import { OriginalTitle, Providers } from '../components/SwipeCard'
import { loadMySwipes, saveSwipe, searchTitles } from '../lib/api'
import { danishError } from '../lib/errors'
import { imageUrl, lengthLabel, trailerUrl, typeLabel } from '../lib/tmdb'
import type { SwipeAction, Title } from '../lib/types'

const STATUS: Record<SwipeAction, string> = {
  like: 'Du vil gerne se den',
  superlike: 'Du har givet den en superlike',
  nope: 'Du har sagt nej tak',
  seen: 'Du har set den',
}

// Søg efter en bestemt film eller serie, og sig "vil gerne se". Din partner får den så
// forrest i køen, og liker din partner den også, bliver det et match.
export function Search({ userId }: { userId: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Title[] | null>(null)
  const [mine, setMine] = useState(new Map<string, SwipeAction>())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setBusy(true)
    setError(null)
    try {
      const titles = await searchTitles(query)
      setResults(titles)
      setMine(await loadMySwipes(userId, titles.map((t) => t.id)))
    } catch (err) {
      setError(danishError(err))
    } finally {
      setBusy(false)
    }
  }

  async function choose(title: Title, action: 'like' | 'superlike') {
    const before = mine.get(title.id)
    setMine((m) => new Map(m).set(title.id, action))
    try {
      await saveSwipe(userId, title.id, action)
    } catch (err) {
      setMine((m) => {
        const next = new Map(m)
        if (before) next.set(title.id, before)
        else next.delete(title.id)
        return next
      })
      setError(danishError(err))
    }
  }

  return (
    <div className="search">
      <h2 className="page-title">Søg</h2>
      <p className="muted small">
        Find en film eller serie, du gerne vil se. Din partner får den så at se forrest i sin kø, og siger din partner
        også ja, bliver det et match.
      </p>
      <form className="row" onSubmit={run}>
        <input
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Titel, fx Matador"
          aria-label="Søg efter titel"
        />
        <button className="primary" disabled={busy || !query.trim()}>{busy ? 'Søger …' : 'Søg'}</button>
      </form>

      {error && <p className="error">{error}</p>}

      {results && results.length === 0 && <p className="muted">Ingen film eller serier passer til søgningen.</p>}

      {results && results.length > 0 && (
        <ul className="match-list search-results">
          {results.map((t) => {
            const md = t.metadata
            const poster = imageUrl(md.poster, 'w185')
            const action = mine.get(t.id)
            const wanted = action === 'like' || action === 'superlike'
            return (
              <li key={t.id} className="match">
                {poster ? <img className="thumb" src={poster} alt="" /> : <div className="thumb" />}
                <div className="match-body">
                  <h3>
                    {md.title} {md.year && <span className="muted">({md.year})</span>}
                  </h3>
                  <OriginalTitle metadata={md} />
                  <p className="meta">
                    {[typeLabel(md.media_type), lengthLabel(md), md.genres.slice(0, 3).join(', ')].filter(Boolean).join(' · ')}
                  </p>
                  <Providers providers={md.providers} />
                  {md.trailer && (
                    <a href={trailerUrl(md.trailer)} target="_blank" rel="noreferrer">▶ Trailer</a>
                  )}
                  {action && <p className={`status-line${wanted ? ' ok' : ''}`}>{STATUS[action]}</p>}
                  <div className="row wrap">
                    <button className={action === 'like' ? 'on-like' : ''} onClick={() => choose(t, 'like')} disabled={action === 'like'}>
                      ♥ Vil gerne se
                    </button>
                    <button
                      className={action === 'superlike' ? 'on-super' : ''}
                      onClick={() => choose(t, 'superlike')}
                      disabled={action === 'superlike'}
                    >
                      ★ Superlike
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

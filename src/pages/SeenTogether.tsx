import { useEffect, useMemo, useState } from 'react'
import { OriginalTitle } from '../components/SwipeCard'
import { RatingDialog, Stars } from '../components/RatingDialog'
import { loadSeenTogether, updateSeen } from '../lib/api'
import { danishError } from '../lib/errors'
import { seasonsLabel } from '../lib/seasons'
import { imageUrl, lengthLabel, typeLabel } from '../lib/tmdb'
import type { Couple, SeasonsSeen, SeenSwipe, SeenTogether as Entry } from '../lib/types'

function seasonsOf(s: SeenSwipe): SeasonsSeen | null {
  return s.seasons_seen?.length || s.all_seasons ? { seen: s.seasons_seen ?? [], all: s.all_seasons } : null
}

// Titler, som I begge har markeret som "har set den", med hver persons vurdering.
export function SeenTogether({ userId, couple }: { userId: string; couple: Couple }) {
  const partner = couple.members.find((m) => m.id !== userId)
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState('')
  const [editing, setEditing] = useState<Entry | null>(null)

  const partnerId = partner?.id
  useEffect(() => {
    if (!partnerId) return
    loadSeenTogether(userId, partnerId).then(setEntries).catch((e) => setError(danishError(e)))
  }, [userId, partnerId])

  const shown = useMemo(() => {
    const latest = (e: Entry) => Math.max(Date.parse(e.mine.created_at), Date.parse(e.partner.created_at))
    return (entries ?? []).filter((e) => !type || e.title.media_type === type).sort((a, b) => latest(b) - latest(a))
  }, [entries, type])

  async function save(entry: Entry, rating: number | null, seasons: SeasonsSeen | null) {
    setEditing(null)
    // "Spring over" i ret-dialogen betyder: lad det være, som det er.
    if (rating === null && seasons === null) return
    const before = entry.mine
    const mine = { ...before, rating, seasons_seen: seasons?.seen.length ? seasons.seen : null, all_seasons: Boolean(seasons?.all) }
    setEntries((list) => list?.map((e) => (e.title.id === entry.title.id ? { ...e, mine } : e)) ?? null)
    try {
      await updateSeen(userId, entry.title.id, rating, seasons)
    } catch (e) {
      setEntries((list) => list?.map((x) => (x.title.id === entry.title.id ? { ...x, mine: before } : x)) ?? null)
      setError(danishError(e))
    }
  }

  if (!partner) {
    return (
      <section className="card">
        <h2>Set af jer begge</h2>
        <p>Her kommer de titler, I begge har set, når din partner er koblet på.</p>
      </section>
    )
  }
  if (error && !entries) return <p className="error">{error}</p>
  if (!entries) return <p className="muted">Henter …</p>

  const partnerName = partner.display_name || 'Partner'

  return (
    <div className="seen-together">
      <h2 className="page-title">Set af jer begge</h2>
      <div className="filters">
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">Film og serier</option>
          <option value="movie">Film</option>
          <option value="tv">Serier</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      {entries.length === 0 ? (
        <section className="card">
          <h2>Ingen fælles titler endnu</h2>
          <p>Når I begge har swipet opad ("har set den") på den samme titel, kommer den her, så I kan se, hvad den anden syntes.</p>
        </section>
      ) : shown.length === 0 ? (
        <p className="muted">Ingen titler passer til filteret.</p>
      ) : (
        <ul className="match-list">
          {shown.map((e) => {
            const md = e.title.metadata
            const poster = imageUrl(md.poster, 'w185')
            const isTv = e.title.media_type === 'tv'
            return (
              <li key={e.title.id} className="match">
                {poster ? <img className="thumb" src={poster} alt="" /> : <div className="thumb" />}
                <div className="match-body">
                  <h3>
                    {md.title} {md.year && <span className="muted">({md.year})</span>}
                  </h3>
                  <OriginalTitle metadata={md} />
                  <p className="meta">
                    {[typeLabel(md.media_type), lengthLabel(md), md.genres.slice(0, 3).join(', ')].filter(Boolean).join(' · ')}
                  </p>
                  <div className="person-rows">
                    <div className="person">
                      <span className="who">Dig</span>
                      <Stars small value={e.mine.rating} />
                      {isTv && <span className="muted seasons">{seasonsLabel(seasonsOf(e.mine))}</span>}
                      <button className="link" onClick={() => setEditing(e)}>Ret</button>
                    </div>
                    <div className="person">
                      <span className="who">{partnerName}</span>
                      <Stars small value={e.partner.rating} />
                      {isTv && <span className="muted seasons">{seasonsLabel(seasonsOf(e.partner))}</span>}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <RatingDialog
          heading={editing.title.metadata.title}
          seasonCount={editing.title.media_type === 'tv' ? editing.title.metadata.seasons : null}
          initialRating={editing.mine.rating}
          initialSeasons={seasonsOf(editing.mine)}
          onDone={(rating, seasons) => save(editing, rating, seasons)}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}

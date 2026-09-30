import { useEffect, useMemo, useState } from 'react'
import { OriginalTitle } from '../components/SwipeCard'
import { RatingDialog, Stars } from '../components/RatingDialog'
import { loadSeenTogether, saveSwipe, updateSeen } from '../lib/api'
import { danishError } from '../lib/errors'
import { compareSeasons, seasonsLabel, seasonsOf } from '../lib/seasons'
import { imageUrl, lengthLabel, typeLabel } from '../lib/tmdb'
import type { Couple, SeasonsSeen, SeenSwipe, SeenTogether as Entry } from '../lib/types'

const latest = (e: Entry) => Math.max(Date.parse(e.mine?.created_at ?? '0'), Date.parse(e.partner?.created_at ?? '0'))

// Titler, som I begge har set, og serier, som den ene af jer er begyndt på, med hver persons
// vurdering og, for serier, hvor langt I er nået.
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

  const partnerName = partner?.display_name || 'Din partner'

  const { ready, rest } = useMemo(() => {
    const list = (entries ?? [])
      .filter((e) => !type || e.title.media_type === type)
      .map((e) => ({
        entry: e,
        comparison:
          e.title.media_type === 'tv' ? compareSeasons(e.mine, e.partner, e.title.metadata.seasons, partnerName) : null,
      }))
      .sort((a, b) => latest(b.entry) - latest(a.entry))
    return {
      ready: list.filter((x) => x.comparison?.readyForSeason),
      rest: list.filter((x) => !x.comparison?.readyForSeason),
    }
  }, [entries, type, partnerName])

  async function save(entry: Entry, rating: number | null, seasons: SeasonsSeen | null) {
    setEditing(null)
    // "Spring over" i ret-dialogen betyder: lad det være, som det er.
    if (rating === null && seasons === null) return
    const before = entry.mine
    const mine: SeenSwipe = {
      user_id: userId,
      title_id: entry.title.id,
      created_at: before?.created_at ?? new Date().toISOString(),
      rating,
      seasons_seen: seasons?.seen.length ? seasons.seen : null,
      all_seasons: Boolean(seasons?.all),
    }
    const put = (m: SeenSwipe | undefined) =>
      setEntries((list) => list?.map((e) => (e.title.id === entry.title.id ? { ...e, mine: m } : e)) ?? null)
    put(mine)
    try {
      // Har man ikke markeret titlen som set før, oprettes (eller overskrives) swipet.
      if (before) await updateSeen(userId, entry.title.id, rating, seasons)
      else await saveSwipe(userId, entry.title.id, 'seen', rating, seasons)
    } catch (e) {
      put(before)
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

  function row(e: Entry, text: string | null) {
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
          {text && <p className="comparison">{text}</p>}
          <div className="person-rows">
            <div className="person">
              <span className="who">Dig</span>
              {e.mine ? (
                <>
                  <Stars small value={e.mine.rating} />
                  {isTv && <span className="muted seasons">{seasonsLabel(seasonsOf(e.mine))}</span>}
                  <button className="link" onClick={() => setEditing(e)}>Ret</button>
                </>
              ) : (
                <>
                  <span className="muted">Ikke set endnu</span>
                  <button className="link" onClick={() => setEditing(e)}>Jeg har set den</button>
                </>
              )}
            </div>
            <div className="person">
              <span className="who">{partnerName}</span>
              {e.partner ? (
                <>
                  <Stars small value={e.partner.rating} />
                  {isTv && <span className="muted seasons">{seasonsLabel(seasonsOf(e.partner))}</span>}
                </>
              ) : (
                <span className="muted">Ikke set endnu</span>
              )}
            </div>
          </div>
        </div>
      </li>
    )
  }

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
          <p>
            Når I begge har swipet opad ("har set den") på den samme titel, kommer den her, så I kan se, hvad den anden
            syntes. Serier kommer også med, når bare den ene af jer har set dem.
          </p>
        </section>
      ) : ready.length + rest.length === 0 ? (
        <p className="muted">Ingen titler passer til filteret.</p>
      ) : (
        <>
          {ready.length > 0 && (
            <section className="ready">
              <h3 className="section-title">Klar til at se sammen</h3>
              <p className="muted small">Serier, hvor I er lige langt, og hvor der er en næste sæson.</p>
              <ul className="match-list">{ready.map((x) => row(x.entry, x.comparison!.text))}</ul>
            </section>
          )}
          {rest.length > 0 && (
            <section>
              {ready.length > 0 && <h3 className="section-title">Alle</h3>}
              <ul className="match-list">{rest.map((x) => row(x.entry, x.comparison?.text ?? null))}</ul>
            </section>
          )}
        </>
      )}

      {editing && (
        <RatingDialog
          heading={editing.title.metadata.title}
          seasonCount={editing.title.media_type === 'tv' ? editing.title.metadata.seasons : null}
          initialRating={editing.mine?.rating ?? null}
          initialSeasons={seasonsOf(editing.mine)}
          onDone={(rating, seasons) => save(editing, rating, seasons)}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}
